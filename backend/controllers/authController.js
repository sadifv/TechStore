const { isStaff } = require('../services/userRoles');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const logger = require('../config/logger');
const { regenerateSession, saveSession, createSessionUser } = require('../services/authSession');
const { getFrontendBaseUrl } = require('../config/frontendUrl');
const { logoutUser, getMe } = require('./authSessionController');
const { forgotPassword, resetPassword } = require('./passwordRecoveryController');
const {
  beginAdminMfaEnrollment,
  confirmAdminMfaEnrollment,
  verifyAdminMfa,
} = require('./adminMfaController');

const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);
// The former registration flow allowed up to 100 characters. Keep that ceiling
// for sign-in so existing accounts with bcrypt-truncated passwords remain usable.
const MAX_LOGIN_PASSWORD_LENGTH = 100;

const registrationMessage =
  'Si el correo está disponible, recibirás un enlace para activar tu cuenta y establecer tu contraseña. Si ya tienes una cuenta, puedes iniciar sesión o solicitar un nuevo enlace desde recuperación.';

// ==========================================
// REGISTRO
// ==========================================
const registerUser = async (req, res, next) => {
  try {
    const { name } = req.body;
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const provisionalPassword = crypto.randomBytes(32).toString('hex');
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // Match the password hashing work for new accounts to reduce timing clues.
      await bcrypt.compare(provisionalPassword, DUMMY_PASSWORD_HASH);
      return res.status(202).json({ success: true, message: registrationMessage });
    }

    const activationToken = crypto.randomBytes(32).toString('hex');
    const newUser = new User({
      name,
      email,
      password: provisionalPassword,
      role: 'user',
      emailVerificationRequired: true,
      resetPasswordToken: crypto.createHash('sha256').update(activationToken).digest('hex'),
      resetPasswordExpires: new Date(Date.now() + 3600000),
    });
    await newUser.save();

    logger.info('Nuevo usuario registrado.');

    res.status(202).json({ success: true, message: registrationMessage });
    Promise.resolve()
      .then(() => {
        const frontendUrl = getFrontendBaseUrl();
        if (!frontendUrl) throw new Error('Falta la URL del frontend.');
        return require('../config/mailer').sendPasswordResetEmail(
          newUser.email,
          `${frontendUrl}/reset-password/${activationToken}`,
          { activation: true },
        );
      })
      .catch((emailError) => {
        logger.warn('No se pudo enviar el correo de activación.', {
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

    const user = await User.findOne({ email }).select(
      '+password +authVersion +adminMfaEnabledAt +emailVerificationRequired',
    );
    if (!user) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      return invalidCredentials(res);
    }

    const isMatch =
      typeof user.comparePassword === 'function'
        ? await user.comparePassword(password)
        : await bcrypt.compare(password, user.password);

    if (!isMatch || user.emailVerificationRequired) return invalidCredentials(res);

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
    req.session.user = createSessionUser(user);
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

const invalidCredentials = (res) =>
  res.status(401).json({
    success: false,
    code: 'INVALID_CREDENTIALS',
    error: 'Correo o contraseña incorrectos.',
  });

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
