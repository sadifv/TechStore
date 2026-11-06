const { auditedHandler } = require('../services/adminAudit');
const Appearance = require('../models/StoreAppearance');
const themes = ['normal', 'halloween', 'christmas'];
exports.getAppearance = async (req, res, next) => {
  try {
    const settings = await Appearance.findById('global').lean();
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, theme: settings?.theme || 'normal' });
  } catch (error) {
    next(error);
  }
};
exports.updateAppearance = async (req, res, next) => {
  const body = req.body;
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => key !== 'theme') ||
    !themes.includes(body.theme)
  ) {
    return res.status(400).json({ success: false, error: 'Selecciona un tema válido.' });
  }
  try {
    const settings = await Appearance.findOneAndUpdate(
      { _id: 'global' },
      { $set: { theme: body.theme } },
      { upsert: true, returnDocument: 'after', runValidators: true },
    );
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, theme: settings.theme });
  } catch (error) {
    next(error);
  }
};

exports.updateAppearance = auditedHandler(
  exports.updateAppearance,
  'appearance.updated',
  (body) => ({ _id: 'global', theme: body.theme }),
);
