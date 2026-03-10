// src/routes/purchase.routes.js
const express = require("express");
const router = express.Router();
const purchaseController = require("../controllers/purchase.controller");

const multer = require("multer");
const path = require("path");

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

const upload = multer({ storage });

// ✅ Queda: /kajamart/api/purchase
router.post("/", upload.single("comprobante"), purchaseController.createPurchase);

// ✅ Queda: /kajamart/api/purchase
router.get("/", purchaseController.getPurchases);

// ✅ Queda: /kajamart/api/purchase/:id_compra/cancel
router.put("/:id_compra/cancel", purchaseController.cancelPurchase);

module.exports = router;
