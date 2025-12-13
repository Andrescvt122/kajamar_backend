const express = require('express');
const router = express.Router();
const { login, forgotPassword, resetPassword } = require('../controllers/auth.controller');

router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword); // Ya no lleva /:token en la URL

module.exports = router;