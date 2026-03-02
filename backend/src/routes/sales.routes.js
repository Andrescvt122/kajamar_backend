// src/routes/sales.routes.js
const express = require("express");
const router = express.Router();
const salesController = require("../controllers/sales.controller");

// GET /kajamart/api/sales
router.get("/", salesController.getSales);

// POST /kajamart/api/sales
router.post("/", salesController.createSale);

// PUT /kajamart/api/sales/:id/status
router.put("/:id/status", salesController.updateSaleStatus);

module.exports = router;