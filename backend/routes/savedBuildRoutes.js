const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const User = require('../models/User');

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
}, requireAuth);

router.get('/', async (req, res) => {
  const account = await User.findById(req.user.id).select('+savedBuild').lean();
  res.json({ success: true, selection: account?.savedBuild ?? null });
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
  for (const part of parts) clean.append('part', part);
  if (clean.toString().length > 1800)
    return res.status(400).json({ success: false, error: 'Selección demasiado larga.' });
  const result = await User.updateOne(
    { _id: req.user.id },
    { $set: { savedBuild: clean.toString() } },
  );
  if (!result.matchedCount)
    return res.status(404).json({ success: false, error: 'Cuenta no disponible.' });
  return res.json({ success: true });
});

module.exports = router;
