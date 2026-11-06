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
module.exports = {
  list: handle((req) => service.listPublicReviews(req.params.productId, req.query.page)),
  mine: handle((req) => service.mine(req.user.id, req.query.productId)),
  save: handle(async (req) => {
    await service.saveReview(req.user.id, req.params.productId, req.body);
    return service.mine(req.user.id, req.params.productId);
  }),
  withdraw: handle(async (req) => {
    await service.withdrawReview(req.user.id, req.params.productId, req.body?.version);
    return service.mine(req.user.id, req.params.productId);
  }),
  moderation: handle((req) => service.listModeration(req.query.status, req.query.page)),
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
