const { STAFF_ROLES, isStaff } = require('../services/userRoles');
const User = require('../models/User');
const logger = require('../config/logger');
const adminMfa = require('../services/adminMfa');
const { regenerateSession, saveSession, createSessionUser } = require('../services/authSession');

const authenticateAfterMfa = async (req, res, user, method) => {
  await regenerateSession(req);
  req.session.user = createSessionUser(user);
  req.session.authLevel = 'mfa';
  await saveSession(req);
  logger.info('Autenticación administrativa MFA completada.', {
    event: 'admin_mfa_login_success',
    method,
  });
  return res.json({ success: true, message: 'Inicio de sesión exitoso.', user: req.session.user });
};

const beginAdminMfaEnrollment = async (req, res) => {
  try {
    if (req.adminMfaPreauth.mode !== 'enroll') {
      return res
        .status(409)
        .json({ success: false, error: 'El administrador ya tiene MFA configurado.' });
    }
    const user = await User.findById(req.adminMfaPreauth.userId).select('email role').lean();
    if (!user || !isStaff(user.role))
      return res.status(401).json({ success: false, error: 'Sesión de verificación inválida.' });
    req.session.adminMfaPreauth.pendingSecret ||= adminMfa.generateSecret();
    await saveSession(req);
    return res.json({
      success: true,
      secret: req.session.adminMfaPreauth.pendingSecret,
      otpauthUri: adminMfa.otpauthUri(req.session.adminMfaPreauth.pendingSecret, user.email),
    });
  } catch (error) {
    logger.error('No se pudo iniciar el enrolamiento MFA.', {
      errorCode: error.code || error.name,
    });
    return res
      .status(500)
      .json({ success: false, error: 'No se pudo iniciar el enrolamiento MFA.' });
  }
};

// Legacy accounts without a stored version have always represented version zero.
const authVersionFilter = (version) =>
  version === 0
    ? { $and: [{ $or: [{ authVersion: 0 }, { authVersion: { $exists: false } }] }] }
    : { authVersion: version };

const confirmAdminMfaEnrollment = async (req, res) => {
  try {
    const { pendingSecret, userId, authVersion } = req.adminMfaPreauth;
    const verified = pendingSecret && adminMfa.verifyTotp(pendingSecret, req.body?.code);
    if (!verified) {
      logger.warn('Falló la confirmación de enrolamiento MFA.', {
        event: 'admin_mfa_enrollment_failed',
      });
      return res
        .status(401)
        .json({ success: false, error: 'El código de autenticación no es válido.' });
    }
    const recoveryCodes = adminMfa.generateRecoveryCodes();
    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        role: { $in: STAFF_ROLES },
        ...authVersionFilter(authVersion),
        adminMfaEnabledAt: { $exists: false },
      },
      {
        $set: {
          adminMfaSecret: adminMfa.encryptSecret(pendingSecret),
          adminMfaEnabledAt: new Date(),
          adminMfaLastTotpStep: verified.step,
          adminMfaRecoveryHashes: recoveryCodes.map(adminMfa.hashRecoveryCode),
          lastLoginAt: new Date(),
        },
      },
      { new: true },
    ).select('+authVersion');
    if (!user)
      return res
        .status(409)
        .json({ success: false, error: 'No se pudo activar MFA para esta cuenta.' });
    await regenerateSession(req);
    req.session.user = createSessionUser(user);
    req.session.authLevel = 'mfa';
    await saveSession(req);
    logger.info('MFA administrativa activada.', { event: 'admin_mfa_enrollment_success' });
    return res.json({ success: true, user: req.session.user, recoveryCodes });
  } catch (error) {
    logger.error('No se pudo confirmar el enrolamiento MFA.', {
      errorCode: error.code || error.name,
    });
    return res.status(500).json({ success: false, error: 'No se pudo confirmar MFA.' });
  }
};

const verifyAdminMfa = async (req, res) => {
  try {
    const { userId, authVersion } = req.adminMfaPreauth;
    const user = await User.findOne({
      _id: userId,
      ...authVersionFilter(authVersion),
      role: { $in: STAFF_ROLES },
      adminMfaEnabledAt: { $exists: true },
    }).select('+authVersion +adminMfaSecret +adminMfaLastTotpStep +adminMfaRecoveryHashes');
    if (!user)
      return res.status(401).json({ success: false, error: 'Sesión de verificación inválida.' });
    let verified = null;
    let secretDecryptionFailed = false;
    try {
      verified = adminMfa.verifyTotp(adminMfa.decryptSecret(user.adminMfaSecret), req.body?.code);
    } catch {
      // Si rotó SESSION_SECRET, todavía se puede recuperar la cuenta con un código de un uso.
      secretDecryptionFailed = true;
    }
    if (verified) {
      const updated = await User.findOneAndUpdate(
        {
          _id: user._id,
          ...authVersionFilter(authVersion),
          role: { $in: STAFF_ROLES },
          adminMfaEnabledAt: { $exists: true },
          $or: [
            { adminMfaLastTotpStep: { $lt: verified.step } },
            { adminMfaLastTotpStep: { $exists: false } },
          ],
        },
        { $set: { adminMfaLastTotpStep: verified.step, lastLoginAt: new Date() } },
        { new: true },
      ).select('+authVersion');
      if (updated) return authenticateAfterMfa(req, res, updated, 'totp');
    }
    const recoveryCode = req.body?.recoveryCode;
    if (typeof recoveryCode === 'string') {
      const hash = adminMfa.hashRecoveryCode(recoveryCode);
      if (secretDecryptionFailed) {
        const recovered = await User.findOneAndUpdate(
          {
            _id: user._id,
            role: { $in: STAFF_ROLES },
            ...authVersionFilter(authVersion),
            adminMfaRecoveryHashes: hash,
          },
          {
            $pull: { adminMfaRecoveryHashes: hash },
            $unset: { adminMfaSecret: '', adminMfaEnabledAt: '', adminMfaLastTotpStep: '' },
          },
          { new: true },
        ).select('+authVersion');
        if (recovered) {
          await regenerateSession(req);
          req.session.adminMfaPreauth = {
            userId: String(recovered._id),
            authVersion: recovered.authVersion || 0,
            mode: 'enroll',
            expiresAt: Date.now() + 10 * 60 * 1000,
          };
          await saveSession(req);
          logger.warn('MFA administrativa requiere nuevo enrolamiento.', {
            event: 'admin_mfa_reenrollment_required',
          });
          return res.json({ success: true, mfaEnrollmentRequired: true });
        }
      }
      const consumed = await User.findOneAndUpdate(
        {
          _id: user._id,
          role: { $in: STAFF_ROLES },
          adminMfaRecoveryHashes: hash,
          ...authVersionFilter(authVersion),
        },
        { $pull: { adminMfaRecoveryHashes: hash }, $set: { lastLoginAt: new Date() } },
        { new: true },
      ).select('+authVersion');
      if (consumed) return authenticateAfterMfa(req, res, consumed, 'recovery');
    }
    logger.warn('Falló una verificación MFA administrativa.', { event: 'admin_mfa_login_failed' });
    return res
      .status(401)
      .json({ success: false, error: 'El código de autenticación no es válido.' });
  } catch (error) {
    logger.error('No se pudo verificar MFA administrativa.', {
      errorCode: error.code || error.name,
    });
    return res.status(500).json({ success: false, error: 'No se pudo verificar MFA.' });
  }
};

module.exports = { beginAdminMfaEnrollment, confirmAdminMfaEnrollment, verifyAdminMfa };
