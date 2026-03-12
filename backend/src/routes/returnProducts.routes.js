const express = require("express");
const router = express.Router();
const returnProductsController = require("../controllers/returnProducts.controller");

router.get("/", returnProductsController.getReturnProducts);
router.get("/all", returnProductsController.getAllReturnProducts);
router.get("/search", returnProductsController.searchReturnProdcts);
router.post("/", returnProductsController.createReturnProduct);
router.patch("/:id/anular", returnProductsController.anularReturnProduct);

module.exports = router;
