const express = require('express');
const router = express.Router();
const lowProductsController = require('../controllers/lowProducts.controller');

router.get('/', lowProductsController.getLowProducts);
router.post('/', lowProductsController.createLowProduct);
router.get('/search', lowProductsController.searchLowProduct);

module.exports = router;