const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const returnProductsController = require("../controllers/returnProducts.controller");

const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/webp",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = path
      .basename(file.originalname || "comprobante", ext)
      .replace(/\s+/g, "_")
      .replace(/[^\w\-]/g, "");

    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (allowedImageMimeTypes.has(file.mimetype)) {
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
