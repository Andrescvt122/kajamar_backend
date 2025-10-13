const express = require('express');
const router = express.Router();
const searchDetailsProductsController = require('../controllers/search/searchDetailsProducts.controller');

router.get('/detailsProducts/:q', searchDetailsProductsController.searchDetailsProducts);
module.exports = router;
