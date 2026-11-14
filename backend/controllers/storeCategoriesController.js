const StoreCategories = require('../models/StoreCategories');
const Product = require('../models/Product');
const { auditedHandler } = require('../services/adminAudit');
const { getCategorySettings, normalizeCategoryList } = require('../services/storeCategories');

exports.getCategories = async (req, res, next) => {
  try {
    const settings = await getCategorySettings();
    return res.set('Cache-Control', 'no-store').json({
      success: true,
      revision: settings.revision,
      categories: settings.categories,
    });
  } catch (error) {
    return next(error);
  }
};

const updateCategories = async (req, res, next) => {
  try {
    const current = await getCategorySettings();
    const categories = normalizeCategoryList(req.body, current.categories);
    if (req.body.revision !== current.revision)
      return res.status(409).json({
        success: false,
        error: 'Otra persona cambió las categorías. Recarga antes de guardar.',
      });
    const byId = new Map(categories.map((entry) => [entry.id, entry]));
    for (const old of current.categories) {
      const names = [old.name, ...(old.aliases || [])];
      if (!byId.has(old.id) && (await Product.exists({ category: { $in: names } })))
        return res.status(409).json({
          success: false,
          error: 'No puedes eliminar una categoría con productos, incluidos los archivados.',
        });
    }
    for (const old of current.categories) {
      const updated = byId.get(old.id);
      if (updated && updated.name !== old.name)
        await Product.updateMany(
          { category: { $in: [old.name, ...(old.aliases || [])] } },
          { $set: { category: updated.name } },
        );
    }
    const saved = await StoreCategories.findOneAndUpdate(
      { _id: 'global', revision: current.revision },
      { $set: { categories, revision: current.revision + 1 } },
      { upsert: current.revision === 0, returnDocument: 'after', runValidators: true },
    );
    if (!saved)
      return res
        .status(409)
        .json({ success: false, error: 'Las categorías cambiaron. Recarga antes de guardar.' });
    return res.json({
      success: true,
      revision: saved.revision,
      categories: saved.categories,
      categoryCount: categories.length,
    });
  } catch (error) {
    if (error.code === 11000)
      return res
        .status(409)
        .json({ success: false, error: 'Las categorías cambiaron. Recarga antes de guardar.' });
    return next(error);
  }
};
exports.updateCategories = auditedHandler(updateCategories, 'category.updated', (body) => ({
  _id: 'global',
  categoryCount: body.categoryCount,
}));
