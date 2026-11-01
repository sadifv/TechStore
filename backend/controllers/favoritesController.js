const mongoose = require('mongoose');
const FavoriteList = require('../models/FavoriteList');
const Product = require('../models/Product');
const Reservation = require('../models/Reservation');
const { toPublicProduct } = require('../services/productPricing');
const owner = (req) => req.user.id;
const listFavorites = async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const list = await FavoriteList.findById(owner(req)).lean();
    const ids = (list?.products || []).map(String);
    const products = await Product.find({ _id: { $in: ids }, archivedAt: null })
      .select('name price image stock flashSale flashSaleEndsAt originalPrice')
      .lean();
    const reserved = await Reservation.getReservedStockByProducts(products.map((p) => p._id));
    const byId = new Map(
      products.map((p) => [
        String(p._id),
        {
          ...toPublicProduct(p),
          availableStock: Math.max(0, p.stock - (reserved.get(String(p._id)) || 0)),
        },
      ]),
    );
    return res.json({
      success: true,
      ids,
      items: ids.map((id) =>
        byId.has(id)
          ? { ...byId.get(id), unavailable: false }
          : { _id: id, name: 'Producto no disponible', unavailable: true },
      ),
    });
  } catch (error) {
    next(error);
  }
};
const mutateFavorite = async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const id = req.params.productId;
    if (typeof id !== 'string' || !/^[a-f0-9]{24}$/i.test(id))
      return res.status(400).json({ success: false, error: 'Producto inválido.' });
    const product = new mongoose.Types.ObjectId(id);
    if (req.method === 'DELETE') {
      await FavoriteList.updateOne({ _id: owner(req) }, { $pull: { products: product } });
      return res.json({ success: true });
    }
    if (!(await Product.exists({ _id: product, archivedAt: null })))
      return res.status(404).json({ success: false, error: 'Producto no disponible.' });
    try {
      await FavoriteList.updateOne(
        { _id: owner(req), user: owner(req) },
        { $setOnInsert: { products: [] } },
        { upsert: true },
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
    const result = await FavoriteList.updateOne(
      {
        _id: owner(req),
        $or: [{ products: product }, { $expr: { $lt: [{ $size: '$products' }, 100] } }],
      },
      { $addToSet: { products: product } },
    );
    if (!result.matchedCount)
      return res.status(409).json({
        success: false,
        error: 'Puedes guardar hasta 100 favoritos. Quita uno antes de añadir otro.',
      });
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
module.exports = { listFavorites, mutateFavorite };
