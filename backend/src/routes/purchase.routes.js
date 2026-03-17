// src/routes/purchase.routes.js
const express = require("express");
const router = express.Router();
const purchaseController = require("../controllers/purchase.controller");

const multer = require("multer");
const path = require("path");
const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/webp",
]);

// ✅ Guarda archivo físico en: backend/src/uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
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

// ✅ Queda: /kajamart/api/purchase
router.post("/", (req, res, next) => {
  upload.single("comprobante")(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        message:
          err.message ||
          "Archivo inválido. Solo se permiten comprobantes en formato de imagen.",
      });
    }

    next();
  });
}, purchaseController.createPurchase);

// ✅ Queda: /kajamart/api/purchase
router.get("/validate-invoice", purchaseController.validatePurchaseInvoiceNumber);

// ✅ Queda: /kajamart/api/purchase
router.get("/", purchaseController.getPurchases);

// ✅ Queda: /kajamart/api/purchase/:id_compra/cancel
router.put("/:id_compra/cancel", purchaseController.cancelPurchase);

module.exports = router;
