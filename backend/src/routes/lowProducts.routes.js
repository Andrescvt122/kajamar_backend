const express = require('express');
const router = express.Router();
const lowProductsController = require('../controllers/lowProducts.controller');

router.get('/', lowProductsController.getLowProducts);

module.exports = router;