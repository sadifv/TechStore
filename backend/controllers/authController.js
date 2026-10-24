const { STAFF_ROLES, isStaff } = require('../services/userRoles');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { sendPasswordResetEmail } = require('../config/mailer');
const logger = require('../config/logger');
const { getFrontendBaseUrl } = require('../config/frontendUrl');
const adminMfa = require('../services/adminMfa');
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);
// The former registration flow allowed up to 100 characters. Keep that ceiling
// for sign-in so existing accounts with bcrypt-truncated passwords remain usable.
const MAX_LOGIN_PASSWORD_LENGTH = 100;

const regenerateSession = (req) =>
  new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });

const isAcceptablePassword = (password) =>
  typeof password === 'string' && Buffer.byteLength(password, 'utf8') <= 72;
const registrationMessage =
  'Solicitud procesada. Si puedes crear una cuenta con este correo, ya está lista; también puedes intentar iniciar sesión.';

const mfaSessionUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
  authVersion: user.authVersion || 0,
});

const saveSession = (req) =>
  new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });

const authenticateAfterMfa = async (req, res, user, method) => {
  await regenerateSession(req);
  req.session.user = mfaSessionUser(user);
  req.session.authLevel = 'mfa';
  await saveSession(req);
  logger.info('Autenticación administrativa MFA completada.', {
    event: 'admin_mfa_login_success',
    method,
  });
  return res.json({ success: true, message: 'Inicio de sesión exitoso.', user: req.session.user });
};

// ==========================================
// REGISTRO
// ==========================================
const registerUser = async (req, res, next) => {
  try {
    const { name, password } = req.body;
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    if (!isAcceptablePassword(password)) {
      return res
        .status(400)
        .json({ success: false, error: 'La contraseña no puede superar 72 bytes UTF-8.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // Match the password hashing work for new accounts to reduce timing clues.
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      return res.status(202).json({ success: true, message: registrationMessage });
    }

    const newUser = new User({ name, email, password, role: 'user' });
    await newUser.save();

    logger.info('Nuevo usuario registrado.');

    res.status(202).json({ success: true, message: registrationMessage });
    Promise.resolve()
      .then(() => require('../config/mailer').sendWelcomeEmail(newUser.email, newUser.name))
      .catch((emailError) => {
        logger.warn('No se pudo enviar el correo de bienvenida.', {
          errorCode: emailError.code || emailError.name,
        });
      });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(202).json({ success: true, message: registrationMessage });
    }
    if (error.name === 'ValidationError') {
      const message = Object.values(error.errors)
        .map((val) => val.message)
        .join(' ');
      return res.status(400).json({ success: false, error: message });
    }
    next(error);
  }
};

// ==========================================
// LOGIN (Blindado y compatible con API/JSON y Web)
// ==========================================
const loginUser = async (req, res) => {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const password = req.body?.password;
    if (typeof password !== 'string' || password.length > MAX_LOGIN_PASSWORD_LENGTH) {
      return invalidCredentials(res);
    }

    const user = await User.findOne({ email }).select('+password +authVersion +adminMfaEnabledAt');
    if (!user) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      return invalidCredentials(res);
    }

    const isMatch =
      typeof user.comparePassword === 'function'
        ? await user.comparePassword(password)
        : await bcrypt.compare(password, user.password);

    if (!isMatch) return invalidCredentials(res);

    if (isStaff(user.role)) {
      await regenerateSession(req);
      req.session.adminMfaPreauth = {
        userId: String(user._id),
        authVersion: user.authVersion || 0,
        mode: user.adminMfaEnabledAt ? 'verify' : 'enroll',
        expiresAt: Date.now() + 10 * 60 * 1000,
      };
      await saveSession(req);
      logger.info('Verificación MFA administrativa requerida.', { event: 'admin_mfa_challenge' });
      return res.status(200).json({
        success: true,
        mfaRequired: Boolean(user.adminMfaEnabledAt),
        mfaEnrollmentRequired: !user.adminMfaEnabledAt,
      });
    }

    user.lastLoginAt = new Date();
    await user.save();
    await regenerateSession(req);
    req.session.user = mfaSessionUser(user);
    await saveSession(req);
    logger.info('Inicio de sesión exitoso.');

    return res.status(200).json({
      success: true,
      message: 'Inicio de sesión exitoso.',
      user: req.session.user,
    });
  } catch (error) {
    logger.error(`Error en loginUser: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor al iniciar sesión.',
    });
  }
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
    req.session.user = mfaSessionUser(user);
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

const invalidCredentials = (res) =>
  res.status(401).json({
    success: false,
    code: 'INVALID_CREDENTIALS',
    error: 'Correo o contraseña incorrectos.',
  });

// ==========================================
// LOGOUT
// ==========================================
const logoutUser = (req, res, next) => {
  if (!req.session) {
    return res.status(200).json({ success: true, message: 'No había una sesión activa.' });
  }

  req.session.destroy((err) => {
    if (err) {
      logger.error(`Error al destruir sesión: ${err.message}`, { stack: err.stack });
      return next(err);
    }

    res.clearCookie('connect.sid', { path: '/' });
    logger.info('Sesión cerrada correctamente.');

    return res.status(200).json({ success: true, message: 'Sesión cerrada correctamente.' });
  });
};

// ==========================================
// GET ME
// ==========================================
const getMe = (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, error: 'No autenticado.' });
  }
  res.status(200).json({ success: true, user: req.session.user });
};

// ==========================================
// FORGOT PASSWORD
// ==========================================
const forgotPassword = (req, res) => {
  const email = String(req.body?.email || '')
    .trim()
    .toLowerCase();
  const frontendUrl = getFrontendBaseUrl() || `${req.protocol}://${req.get('host')}`;

  res.status(200).json({
    success: true,
    message:
      'Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.',
  });

  // Resolve accounts and send email after the generic response so account lookup,
  // database writes, and SMTP latency cannot distinguish registered addresses.
  Promise.resolve()
    .then(async () => {
      const user = await User.findOne({ email }).select(
        '+resetPasswordToken +resetPasswordExpires',
      );
      if (!user) return;

      const resetToken = crypto.randomBytes(32).toString('hex');
      user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      user.resetPasswordExpires = Date.now() + 3600000;
      await user.save();

      await sendPasswordResetEmail(user.email, `${frontendUrl}/reset-password/${resetToken}`);
      logger.info('Correo de recuperación enviado.');
    })
    .catch((error) => {
      logger.warn('No se pudo procesar una solicitud de recuperación.', {
        errorCode: error.code || error.name,
      });
    });
};

// ==========================================
// RESET PASSWORD
// ==========================================
const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    if (!isAcceptablePassword(password)) {
      return res
        .status(400)
        .json({ success: false, error: 'La contraseña no puede superar 72 bytes UTF-8.' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    }).select('+authVersion +resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'El token de recuperación es inválido o ha expirado.',
      });
    }

    user.password = password;
    user.authVersion = (user.authVersion || 0) + 1;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    logger.info('Contraseña restablecida correctamente.');

    res.status(200).json({
      success: true,
      message:
        'Contraseña restablecida con éxito. Puedes iniciar sesión con tus nuevas credenciales.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getMe,
  forgotPassword,
  resetPassword,
  beginAdminMfaEnrollment,
  confirmAdminMfaEnrollment,
  verifyAdminMfa,
};
