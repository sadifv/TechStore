const actorId = (req) =>
  req.session?.user?.id || req.session?.user?._id || req.user?.id || req.user?._id;
const orderEvent = (type, actor, at = new Date()) => ({ type, actor, at });
module.exports = { actorId, orderEvent };
