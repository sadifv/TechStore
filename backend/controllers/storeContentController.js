const StoreContent = require('../models/StoreContent');
const { defaults, normalizeContent } = require('../services/storeContent');
const { auditedHandler } = require('../services/adminAudit');

exports.getContent = async (req, res, next) => {
  try {
    const stored = await StoreContent.findById('global').lean();
    res.set('Cache-Control', 'no-store').json({
      success: true,
      content: { ...defaults, ...stored?.content },
      revision: stored?.revision || 0,
    });
  } catch (error) {
    next(error);
  }
};
exports.updateContent = auditedHandler(
  async (req, res, next) => {
    try {
      const content = normalizeContent(req.body);
      const update = Object.fromEntries(
        Object.entries(content).map(([key, value]) => [`content.${key}`, value]),
      );
      const saved = await StoreContent.findOneAndUpdate(
        { _id: 'global', revision: req.body.revision },
        { $set: update, $inc: { revision: 1 } },
        { upsert: req.body.revision === 0, returnDocument: 'after', runValidators: true },
      );
      if (!saved)
        return res.status(409).json({
          success: false,
          error: 'El contenido cambió. Recarga antes de guardar para no sobrescribir cambios.',
        });
      return res.json({
        success: true,
        revision: saved.revision,
        updatedFields: Object.keys(content),
      });
    } catch (error) {
      if (error.code === 11000)
        return res
          .status(409)
          .json({ success: false, error: 'El contenido cambió. Recarga antes de guardar.' });
      next(error);
    }
  },
  'content.updated',
  (body) => ({ _id: 'global', updatedFields: body.updatedFields }),
);
