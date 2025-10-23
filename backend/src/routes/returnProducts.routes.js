const express = require("express");
const router = express.Router();
const returnProductsController = require("../controllers/returnProducts.controller");

router.get("/", returnProductsController.getReturnProducts);

module.exports = router;
