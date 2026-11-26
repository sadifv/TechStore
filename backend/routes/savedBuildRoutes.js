const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Product = require('../models/Product');
const Reservation = require('../models/Reservation');
const { activeProductFilter } = require('../services/productAvailability');
const { getEffectivePrice } = require('../services/productPricing');

const maxNewBuilds = 10;
const objectId = /^[\da-f]{24}$/i;

async function catalogSnapshot(filter, limit) {
  const products = await Product.find({ ...activeProductFilter(), ...filter })
    .select('_id name price stock flashSale flashSaleEndsAt originalPrice')
    .limit(limit)
    .lean();
  const reserved = await Reservation.getReservedStockByProducts(products.map(({ _id }) => _id));
  const now = Date.now();
  return products.map((product) => ({
    product: product._id,
    name: product.name,
    price: getEffectivePrice(product, now),
    available: product.stock > (reserved.get(String(product._id)) ?? 0),
  }));
}

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
}, requireAuth);

router.get('/', async (req, res) => {
  const account = await User.findById(req.user.id).select('+savedBuild +savedBuilds').lean();
  const builds = account?.savedBuilds ?? [];
  const ids = builds.flatMap(({ parts }) => parts.map(({ product }) => product));
  const legacy = account?.savedBuild ?? null;
  const current = ids.length ? await catalogSnapshot({ _id: { $in: ids } }, ids.length) : [];
  const byId = new Map(current.map((part) => [String(part.product), part]));
  const data = builds.map(({ _id, selection, savedAt, parts }) => ({
    id: String(_id),
    selection,
    savedAt,
    changes: parts.flatMap((part) => {
      const latest = byId.get(String(part.product));
      if (!latest || latest.name !== part.name) return [{ name: part.name, unavailable: true }];
      if (latest.price === part.price && latest.available === part.available) return [];
      return [{
        name: part.name,
        ...(latest.price !== part.price ? { previousPrice: part.price, currentPrice: latest.price } : {}),
        ...(latest.available !== part.available ? { available: latest.available } : {}),
      }];
    }),
  }));
  if (legacy) data.push({ id: 'anterior', selection: legacy, changes: null });
  res.json({ success: true, selection: data[0]?.selection ?? null, builds: data });
});

router.put('/', async (req, res) => {
  const { selection } = req.body ?? {};
  if (typeof selection !== 'string' || selection.length > 1800) {
    return res.status(400).json({ success: false, error: 'Selección inválida.' });
  }
  const params = new URLSearchParams(selection);
  const parts = params.getAll('part');
  const kit = params.get('kit');
  const platform = params.get('platform');
  if (
    !['pc', 'coffee', 'kitchen', 'desk', 'study', 'gaming', 'streaming'].includes(kit) ||
    (kit === 'pc' ? !['AM4', 'AM5'].includes(platform) : platform !== null) ||
    parts.length < 1 ||
    parts.length > 8 ||
    parts.some(
      (part) => !part.trim() || part.length > 100 || /[\u0000-\u001f\u007f]/u.test(part),
    ) ||
    new Set(parts).size !== parts.length
  ) {
    return res.status(400).json({ success: false, error: 'Selección inválida.' });
  }
  const clean = new URLSearchParams({ kit });
  if (platform) clean.set('platform', platform);
  for (const part of kit === 'pc' ? parts : [...parts].sort()) clean.append('part', part);
  if (clean.toString().length > 1800)
    return res.status(400).json({ success: false, error: 'Selección demasiado larga.' });
  const canonical = clean.toString();
  const accountId = req.user.id;
  const snapshot = await catalogSnapshot({ name: { $in: parts } }, parts.length + 1);
  if (snapshot.length !== parts.length || new Set(snapshot.map(({ name }) => name)).size !== parts.length)
    return res.status(409).json({ success: false, error: 'Revisa los productos de tu selección antes de guardarla.' });
  const entry = { selection: canonical, savedAt: new Date(), parts: snapshot };
  // Convert an identical legacy selection in the same update that saves its baseline.
  const capacity = { [`savedBuilds.${maxNewBuilds - 1}`]: { $exists: false } };
  const unique = { 'savedBuilds.selection': { $ne: canonical } };
  const push = { $push: { savedBuilds: { $each: [entry], $position: 0 } } };
  const migrated = await User.updateOne(
    { _id: accountId, savedBuild: canonical, ...capacity, ...unique },
    { ...push, $unset: { savedBuild: '' } },
  );
  if (migrated.modifiedCount) return res.json({ success: true });
  const added = await User.updateOne(
    { _id: accountId, savedBuild: { $ne: canonical }, ...capacity, ...unique },
    push,
  );
  if (added.modifiedCount) return res.json({ success: true });
  if (await User.exists({ _id: accountId, 'savedBuilds.selection': canonical }))
    return res.json({ success: true, alreadySaved: true });
  return res.status(409).json({
    success: false,
    error: `Puedes guardar hasta ${maxNewBuilds} selecciones nuevas. Elimina una desde Mi cuenta para guardar otra.`,
  });
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (id !== 'anterior' && !objectId.test(id))
    return res.status(400).json({ success: false, error: 'Selección inválida.' });
  const update = id === 'anterior'
    ? { $unset: { savedBuild: '' } }
    : { $pull: { savedBuilds: { _id: id } } };
  await User.updateOne({ _id: req.user.id }, update);
  return res.json({ success: true });
});

module.exports = router;
