// backend/src/routes/products.routes.js
const express = require("express");
const router = express.Router();
const fs = require("fs");
const multer = require("multer");
const path = require("path");

const {
  getAllProducts,
  getProductsBySupplier,
  createProduct,
  updateProduct,
  deleteProduct,
  getRandomProduct,
  getProductsByCategory,
  getProductById,
  getProducts,
  searchProducts,
} = require("../controllers/products.controller");

const allowedImageMimeTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/jpg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Config multer (carpeta uploads/)
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = allowedImageMimeTypes.get(file.mimetype);
    cb(null, `${unique}${ext || ".bin"}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowedImageMimeTypes.has(file.mimetype)) {
      cb(new Error("Archivo inválido. Solo se permiten imágenes JPG, PNG o WebP."));
      return;
    }

    cb(null, true);
  },
});

const handleUploadImage = (req, res, next) => {
  upload.single("imagen")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }

    next();
  });
};

// Rutas
router.get("/", getAllProducts);
router.get("/all", getProducts);
router.get("/search", searchProducts);
router.get("/supplier/:id", getProductsBySupplier);
router.get("/random", getRandomProduct);
router.get("/category", getProductsByCategory);
router.get("/:id", getProductById);

router.post("/", handleUploadImage, createProduct);
router.put("/:id", handleUploadImage, updateProduct);

router.delete("/:id", deleteProduct);

module.exports = router;
