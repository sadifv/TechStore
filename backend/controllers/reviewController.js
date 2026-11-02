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
    await service.moderateReview(req.user.id, req.params.id, req.body);
    return { updated: true };
  }),
};
