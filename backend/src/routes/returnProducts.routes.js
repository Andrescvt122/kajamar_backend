const express = require("express");
const router = express.Router();
const returnProductsController = require("../controllers/returnProducts.controller");

router.get("/", returnProductsController.getReturnProducts);
router.get("/search", returnProductsController.getOneReturnProdcts);

module.exports = router;
