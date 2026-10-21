const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { sendPasswordResetEmail } = require('../config/mailer');
const logger = require('../config/logger');
const { getFrontendBaseUrl } = require('../config/frontendUrl');
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

// ==========================================
// REGISTRO
// ==========================================
const registerUser = async (req, res, next) => {
  try {
    const { name, password } = req.body;
    const email = String(req.body?.email || '').trim().toLowerCase();
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

    const user = await User.findOne({ email }).select('+password +authVersion');
    if (!user) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      return invalidCredentials(res);
    }

    const isMatch =
      typeof user.comparePassword === 'function'
        ? await user.comparePassword(password)
        : await bcrypt.compare(password, user.password);

    if (!isMatch) return invalidCredentials(res);

    user.lastLoginAt = new Date();
    await user.save();

    await regenerateSession(req);
    req.session.user = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      authVersion: user.authVersion || 0,
    };

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
};
