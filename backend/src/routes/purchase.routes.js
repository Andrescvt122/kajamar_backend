const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchase.controller');

router.get('/', purchaseController.getAllPruchase);

module.exports = router;