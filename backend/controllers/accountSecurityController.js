const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { isSingleEmail } = require('../services/emailAddress');
const { isAcceptablePassword } = require('../services/passwordPolicy');
const { isStaff } = require('../services/userRoles');
const mfa = require('../services/adminMfa');
const { destroySession } = require('../middleware/authMiddleware');
const { sendAccountEmailChange } = require('../config/mailer');

const pendingFields = { emailChangeTarget: '', emailChangeHash: '', emailChangeExpires: '', emailChangeVersion: '' };
const fail = (status, message) => Object.assign(new Error(message), { status });
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const versionFilter = (version) => version === 0
  ? { $or: [{ authVersion: 0 }, { authVersion: { $exists: false } }] }
  : { authVersion: version };

function validateBody(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !allowed.includes(key)))
    throw fail(400, 'Los datos enviados no son válidos.');
}

async function currentAccount(req, credentials = false) {
  const user = await User.findById(req.user.id).select(
    '+password +authVersion +adminMfaSecret +adminMfaEnabledAt +adminMfaLastTotpStep +emailChangeTarget +emailChangeHash +emailChangeExpires +emailChangeVersion',
  ).lean();
  if (!user || (user.authVersion || 0) !== req.user.authVersion)
    throw fail(409, 'La cuenta cambió. Inicia sesión de nuevo.');
  const filter = { _id: user._id, role: user.role, email: user.email,
    $and: [versionFilter(user.authVersion || 0)] };
  const changes = {};
  if (isStaff(user.role) && (req.session?.authLevel !== 'mfa' || !user.adminMfaEnabledAt))
    throw fail(403, 'Inicia sesión y completa MFA para modificar esta cuenta.');
  if (credentials) {
    const password = req.body.currentPassword;
    if (typeof password !== 'string' || password.length > 100 || !(await bcrypt.compare(password, user.password)))
      throw fail(403, 'No se pudo confirmar tu identidad. Comprueba tu contraseña.');
    filter.password = user.password;
    if (isStaff(user.role)) {
      let verified;
      try { verified = mfa.verifyTotp(mfa.decryptSecret(user.adminMfaSecret), req.body.code); }
      catch { verified = null; }
      if (!verified) throw fail(403, 'Introduce un código nuevo de tu aplicación autenticadora.');
      filter.adminMfaSecret = user.adminMfaSecret;
      filter.$and.push({ $or: [
        { adminMfaLastTotpStep: { $lt: verified.step } },
        { adminMfaLastTotpStep: { $exists: false } },
      ] });
      changes.adminMfaLastTotpStep = verified.step;
    }
  }
  return { user, filter, changes };
}

const action = (handler) => async (req, res, next) => {
  try { return await handler(req, res); }
  catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, error: 'No se pudo usar ese correo. Conservas tu correo actual.' });
    if (error.status) return res.status(error.status).json({ success: false, error: error.message });
    return next(error);
  }
};

const changeName = action(async (req, res) => {
  validateBody(req.body, ['name']);
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (name.length < 2 || name.length > 80 || /[\p{Cc}\p{Cf}]/u.test(name))
    throw fail(400, 'Usa un nombre de 2 a 80 caracteres, sin caracteres de control.');
  const { filter } = await currentAccount(req);
  const updated = await User.findOneAndUpdate(filter, { $set: { name } }, { returnDocument: 'after', runValidators: true });
  if (!updated) throw fail(409, 'La cuenta cambió. Vuelve a intentarlo.');
  return res.json({ success: true, user: { id: String(updated._id), name: updated.name, email: updated.email, role: updated.role } });
});

const changePassword = action(async (req, res) => {
  validateBody(req.body, ['currentPassword', 'password', 'code']);
  if (!isAcceptablePassword(req.body.password) || req.body.password.length < 12)
    throw fail(400, 'Usa al menos 12 caracteres y como máximo 72 bytes UTF-8.');
  const { filter, changes } = await currentAccount(req, true);
  changes.password = await bcrypt.hash(req.body.password, 10);
  const updated = await User.findOneAndUpdate(filter, {
    $set: changes, $inc: { authVersion: 1 },
    $unset: { ...pendingFields, resetPasswordToken: '', resetPasswordExpires: '' },
  });
  if (!updated) throw fail(409, 'La cuenta cambió o el código MFA ya se utilizó. Inicia sesión de nuevo.');
  await destroySession(req, res);
  return res.json({ success: true, signInRequired: true, message: 'Contraseña actualizada. Inicia sesión de nuevo; las sesiones anteriores se revocaron.' });
});

const requestEmailChange = action(async (req, res) => {
  validateBody(req.body, ['currentPassword', 'email', 'code']);
  if (typeof req.body.email !== 'string' || req.body.email.length > 254 || !isSingleEmail(req.body.email))
    throw fail(400, 'Introduce un único correo electrónico válido.');
  const email = req.body.email.trim().toLowerCase();
  const { user, filter, changes } = await currentAccount(req, true);
  if (email === user.email) throw fail(400, 'Ese ya es tu correo actual.');
  if (user.emailChangeExpires && new Date(user.emailChangeExpires).getTime() > Date.now() + 14 * 60 * 1000)
    throw fail(429, 'Espera un minuto antes de solicitar otro código.');
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  filter.$and.push({ $or: [
    { emailChangeExpires: { $exists: false } },
    { emailChangeExpires: { $lte: new Date(Date.now() + 14 * 60 * 1000) } },
  ] });
  const updated = await User.findOneAndUpdate(filter, { $set: {
    ...changes, emailChangeTarget: email, emailChangeHash: tokenHash,
    emailChangeVersion: user.authVersion || 0,
    emailChangeExpires: new Date(Date.now() + 15 * 60 * 1000),
  } });
  if (!updated) throw fail(409, 'Ya existe una solicitud reciente o la cuenta cambió.');
  try {
    const delivery = await sendAccountEmailChange(email, token);
    if (delivery?.simulated) throw new Error('Simulated delivery');
  } catch {
    await User.updateOne({ _id: user._id, emailChangeHash: tokenHash }, { $unset: pendingFields });
    throw fail(503, 'No se pudo enviar el código. Tu correo actual no ha cambiado; vuelve a intentarlo más tarde.');
  }
  return res.json({ success: true, message: 'Revisa el nuevo correo y pega aquí el código recibido. Caduca en 15 minutos. Tu correo actual sigue activo.' });
});

const confirmEmailChange = action(async (req, res) => {
  validateBody(req.body, ['currentPassword', 'token', 'code']);
  if (typeof req.body.token !== 'string' || !/^[a-f0-9]{64}$/.test(req.body.token))
    throw fail(400, 'El código de confirmación no es válido.');
  const { user, filter, changes } = await currentAccount(req, true);
  if (!user.emailChangeTarget || user.emailChangeVersion !== (user.authVersion || 0) || user.emailChangeHash !== hashToken(req.body.token) ||
      !(new Date(user.emailChangeExpires).getTime() > Date.now()))
    throw fail(400, 'El código no es válido o ha caducado. Solicita uno nuevo.');
  filter.emailChangeHash = user.emailChangeHash;
  filter.emailChangeExpires = { $gt: new Date() };
  const updated = await User.findOneAndUpdate(filter, {
    $set: { ...changes, email: user.emailChangeTarget, isVerified: true },
    $inc: { authVersion: 1 },
    $unset: { ...pendingFields, resetPasswordToken: '', resetPasswordExpires: '', verificationToken: '', verificationTokenExpires: '' },
  }, { runValidators: true });
  if (!updated) throw fail(409, 'La solicitud ya se utilizó o la cuenta cambió. Inicia sesión de nuevo.');
  await destroySession(req, res);
  return res.json({ success: true, signInRequired: true, message: 'Correo actualizado. Inicia sesión con tu nuevo correo; las sesiones anteriores se revocaron.' });
});

module.exports = { changeName, changePassword, requestEmailChange, confirmEmailChange };
