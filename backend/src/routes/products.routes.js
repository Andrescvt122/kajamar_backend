const express = require("express");
const router = express.Router();
const productsController = require("../controllers/products.controller");

router.get("/random/:id", productsController.getRandomProduct);
module.exports = router;
