// backend/src/routes/products.routes.js
const express = require("express");
const router = express.Router();
const {
  getAllProducts,
  getProductsBySupplier,
  createProduct,
  updateProduct,
  deleteProduct,
  getRandomProduct
} = require("../controllers/products.controller");
const productsController = require("../controllers/products.controller");

router.get("/", getAllProducts);
router.get("/supplier/:id", getProductsBySupplier);
router.post("/", createProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);
router.get("/random", getRandomProduct);

module.exports = router;