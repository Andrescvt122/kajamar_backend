const express = require("express");
const router = express.Router();
const productsController = require("../controllers/products.controller");

router.get("/random", productsController.getRandomProduct);
module.exports = router;
