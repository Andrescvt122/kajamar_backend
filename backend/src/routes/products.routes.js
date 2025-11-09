// backend/src/routes/products.routes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const {
  getAllProducts,
  getProductsBySupplier,
  createProduct,
  updateProduct,
  deleteProduct,
  getRandomProduct,
} = require("../controllers/products.controller");

// Config multer (carpeta uploads/)
const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "uploads"),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({ storage });

// Rutas
router.get("/", getAllProducts);
router.get("/supplier/:id", getProductsBySupplier);
router.get("/random", getRandomProduct);

// 👇 aquí usamos upload.single("imagen")
router.post("/", upload.single("imagen"), createProduct);
router.put("/:id", upload.single("imagen"), updateProduct);

router.delete("/:id", deleteProduct);

module.exports = router;
