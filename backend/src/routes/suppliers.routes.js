const express = require("express");
const {
  getAllSuppliers,
  getSuppliersForDashboard,
  searchSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierDetail, 
} = require("../controllers/suppliers.controller");

const router = express.Router();

router.get("/", getAllSuppliers);
router.get("/all", getSuppliersForDashboard);
router.get("/search", searchSuppliers);
router.get("/:id/detail", getSupplierDetail);   
router.get("/:id", getSupplierById);
router.post("/", createSupplier);
router.put("/:id", updateSupplier);
router.delete("/:id", deleteSupplier);

module.exports = router;
