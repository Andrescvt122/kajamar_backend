const express = require("express");
const router = express.Router();
const controller = require("../controllers/suppliers.controller");

router.get("/", controller.getAllSuppliers);
router.get("/:id", controller.getSupplierById);
router.post("/", controller.createSupplier);
router.put("/:id", controller.updateSupplier);
router.delete("/:id", controller.deleteSupplier);

module.exports = router;
