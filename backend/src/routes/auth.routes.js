const express = require('express');
const router = express.Router();
// Asegúrate de que la ruta al controlador sea correcta según tu estructura
const { login, forgotPassword, resetPassword } = require('../controllers/auth.controller');

router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

module.exports = router;