// backend/src/routes/products.routes.js
const express = require("express");
const {
  getAllProducts,
  getProductsBySupplier,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/products.controller");

const router = express.Router();

router.get("/", getAllProducts);
router.get("/supplier/:id", getProductsBySupplier);
router.post("/", createProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

module.exports = router;
