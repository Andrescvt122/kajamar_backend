const express = require("express");
const {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierDetail, 
} = require("../controllers/suppliers.controller");

const router = express.Router();

router.get("/", getAllSuppliers);
router.get("/:id", getSupplierById);
router.get("/:id/detail", getSupplierDetail);   
router.post("/", createSupplier);
router.put("/:id", updateSupplier);
router.delete("/:id", deleteSupplier);

module.exports = router;
