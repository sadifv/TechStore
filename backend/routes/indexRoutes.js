const express = require('express');
const router = express.Router();
const { redirectToFrontend } = require('../config/frontendUrl');

// Las páginas las sirve React. Estas redirecciones mantienen enlaces antiguos
// y accesos directos funcionando durante el despliegue separado del frontend.
router.get('/', redirectToFrontend);
router.get('/catalogo', redirectToFrontend);
router.get('/producto/:id', redirectToFrontend);
router.get('/legal', redirectToFrontend);
router.get('/login', redirectToFrontend);
router.get('/register', redirectToFrontend);
router.get('/profile', redirectToFrontend);
router.get('/forgot-password', redirectToFrontend);
router.get('/reset-password/:token', redirectToFrontend);

module.exports = router;
