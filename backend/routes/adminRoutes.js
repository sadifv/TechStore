const express = require('express');
const router = express.Router();
const { redirectToFrontend } = require('../config/frontendUrl');

for (const route of ['/', '/dashboard', '/marketing', '/orders', '/orders/:id/packing-slip', '/orders/:id', '/users']) {
  router.get(route, redirectToFrontend);
}
// Retain legacy backend URLs; both mounts share the same authorized handlers.
router.use(require('./adminMutationRoutes'));
module.exports = router;
