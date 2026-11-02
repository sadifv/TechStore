const s = require('../services/customerAddresses');
const handle = (fn) => async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: await fn(req) });
  } catch (e) {
    next(e);
  }
};
module.exports = {
  list: handle((req) => s.getAddressBook(req.user.id)),
  add: handle((req) => s.addAddress(req.user.id, req.body)),
  edit: handle((req) => s.changeAddress(req.user.id, req.params.id, 'edit', req.body)),
  remove: handle((req) => s.changeAddress(req.user.id, req.params.id, 'delete', req.body)),
  setDefault: handle((req) => s.changeAddress(req.user.id, req.params.id, 'default', req.body)),
};
