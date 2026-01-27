const express = require('express');
const router = express.Router();
const searchDetailsProductsController = require('../controllers/search/searchDetailsProducts.controller');
const searchPurchase = require('../controllers/search/searchPurchase.controller');
const searchSaleController = require('../controllers/search/searchSale.controller');

router.get('/sale/:q', searchSaleController.searachSale);
router.get('/detailsProducts/:q', searchDetailsProductsController.searchDetailsProducts);
router.get('/purchase/:q', searchPurchase.searchPurchase);

module.exports = router;
