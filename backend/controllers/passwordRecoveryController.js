const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { sendPasswordResetEmail } = require('../config/mailer');
const logger = require('../config/logger');
const { getFrontendBaseUrl } = require('../config/frontendUrl');
const { isAcceptablePassword } = require('../services/passwordPolicy');

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

// RESET PASSWORD
const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const password = req.body?.password;
    if (!isAcceptablePassword(password) || password.length < 12 || password.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Usa al menos 12 caracteres y como máximo 72 bytes UTF-8.',
      });
    }

    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token))
      return res
        .status(400)
        .json({ success: false, error: 'El token de recuperación es inválido o ha expirado.' });

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    // Consume the token and revoke sessions in the same atomic write. Two
    // requests must never both save different passwords from the same token.
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.findOneAndUpdate(
      { resetPasswordToken: hashedToken, resetPasswordExpires: { $gt: new Date() } },
      {
        $set: { password: passwordHash },
        $inc: { authVersion: 1 },
        $unset: { resetPasswordToken: '', resetPasswordExpires: '' },
      },
      { returnDocument: 'after', runValidators: true },
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'El token de recuperación es inválido o ha expirado.',
      });
    }

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

module.exports = { forgotPassword, resetPassword };
