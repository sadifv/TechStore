const express = require('express');
const router = express.Router();

// Ruta temporal de admin
router.get('/dashboard', (req, res) => {
    res.render('admin/dashboard');
});

module.exports = router;