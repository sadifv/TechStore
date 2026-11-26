const { auditedHandler, recordAudit } = require('../services/adminAudit');
const service = require('../services/productReviews');
const handle = (fn) => async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: await fn(req) });
  } catch (e) {
    next(e);
  }
};
const servePhoto = (find) => async (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'X-Content-Type-Options': 'nosniff',
  });
  try {
    const photo = await find(req);
    if (!photo?.photoData) return res.status(404).end();
    return res.type(photo.photoContentType).send(photo.photoData);
  } catch (error) {
    return next(error);
  }
};
module.exports = {
  list: handle((req) => service.listPublicReviews(req.params.productId, req.query.page)),
  mine: handle((req) => service.mine(req.user.id, req.query.productId)),
  save: handle(async (req) => {
    await service.saveReview(req.user.id, req.params.productId, req.body, req.file);
    return service.mine(req.user.id, req.params.productId);
  }),
  withdraw: handle(async (req) => {
    await service.withdrawReview(req.user.id, req.params.productId, req.body?.version);
    return service.mine(req.user.id, req.params.productId);
  }),
  moderation: handle((req) => service.listModeration(req.query.status, req.query.page)),
  publicPhoto: servePhoto((req) => service.publicPhoto(req.params.productId, req.params.key)),
  ownPhoto: servePhoto((req) => service.ownPhoto(req.user.id, req.params.productId, req.params.key)),
  moderationPhoto: servePhoto((req) => service.moderationPhoto(req.params.id, req.params.key)),
  moderate: handle(async (req) => {
    const row = await service.moderateReview(req.user.id, req.params.id, req.body);
    await recordAudit({
      actorId: req.user.id,
      action: 'review.moderated',
      resourceId: row._id,
      value: row,
    });
    return { updated: true };
  }),
};

module.exports.moderate = auditedHandler(module.exports.moderate, 'review.moderated', () => null);
