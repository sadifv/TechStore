const Presence = require('../models/Presence');

const recordHeartbeat = async (req, res, next) => {
  try {
    const userId = req.session?.user?.id || req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Debes iniciar sesión para registrar tu actividad.',
      });
    }

    const lastSeenAt = new Date();
    await Presence.updateOne({ user: userId }, { $set: { lastSeenAt } }, { upsert: true });

    return res.json({ success: true, lastSeenAt });
  } catch (error) {
    return next(error);
  }
};

module.exports = { recordHeartbeat };
