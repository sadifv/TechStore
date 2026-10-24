const mongoose = require('mongoose');
const User = require('../models/User');
const Presence = require('../models/Presence');
const logger = require('../config/logger');

// requireOwner reloads the actor and verifies MFA before this controller runs.
async function updateUserRole(req, res, next) {
  const role = req.body?.role;
  if (!mongoose.isObjectIdOrHexString(req.params.id) || !['user', 'admin'].includes(role)) {
    return res.status(400).json({ success: false, error: 'Usuario o rol inválido.' });
  }
  const previousRole = role === 'admin' ? 'user' : 'admin';
  try {
    // Restrict the target in the write itself: owner can never be changed by this API.
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: previousRole },
      { $set: { role }, $inc: { authVersion: 1 } },
      { returnDocument: 'after', runValidators: true },
    ).select('name role');
    if (!user) {
      return res
        .status(409)
        .json({
          success: false,
          error:
            'No se pudo cambiar el rol. La cuenta está protegida, no existe o su rol ya cambió. Actualiza la lista.',
        });
    }
    logger.info('Rol de usuario actualizado por el propietario.', {
      event: 'user_role_changed',
      actorId: req.user.id,
      targetId: String(user._id),
      previousRole,
      role,
    });
    return res.json({
      success: true,
      message: 'Rol actualizado. La persona debe iniciar sesión de nuevo.',
      user,
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteUser(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ success: false, error: 'Usuario inválido.' });
  }
  try {
    // Administrators and the owner are protected, including concurrent promotions.
    const user = await User.findOneAndDelete({ _id: req.params.id, role: 'user' });
    if (!user) {
      return res
        .status(409)
        .json({
          success: false,
          error: 'La cuenta no existe o es una cuenta administrativa protegida.',
        });
    }
    await Presence.deleteOne({ user: user._id });
    return res.json({ success: true, message: 'Usuario eliminado correctamente.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = { updateUserRole, deleteUser };
