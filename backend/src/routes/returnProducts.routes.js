const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const returnProductsController = require("../controllers/returnProducts.controller");

const allowedImageExtensions = new Map([
  ["image/jpeg", ".jpg"],
  ["image/jpg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadsDir = path.join(__dirname, "../uploads");

    try {
      fs.mkdirSync(uploadsDir, { recursive: true });
      cb(null, uploadsDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (_req, file, cb) => {
    const ext = allowedImageExtensions.get(file.mimetype);
    if (!ext) {
      cb(new Error("Tipo de archivo no permitido"));
      return;
    }

    const base = path
      .basename(file.originalname || "comprobante", path.extname(file.originalname || ""))
      .replace(/\s+/g, "_")
      .replace(/[^\w\-]/g, "")
      .slice(0, 80);

    cb(null, `${Date.now()}-${base || "comprobante"}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowedImageExtensions.has(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new Error("Solo se permiten comprobantes en formato de imagen (JPG, PNG o WebP)."));
  },
});

router.get("/", returnProductsController.getReturnProducts);
router.get("/all", returnProductsController.getAllReturnProducts);
router.get("/search", returnProductsController.searchReturnProdcts);
router.post("/", (req, res, next) => {
  upload.single("comprobante")(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        error:
          err.message ||
          "Archivo inválido. Solo se permiten comprobantes en formato de imagen.",
      });
    }

    next();
  });
}, returnProductsController.createReturnProduct);
router.patch("/:id/anular", returnProductsController.anularReturnProduct);

module.exports = router;
