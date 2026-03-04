const express = require("express");
const router = express.Router();

const {
  createDetailProduct,
  getAllDetails,
  getDetailsByProduct,
  getDetailById,
  updateDetailProduct,
  deleteDetailProduct,
  deleteOneDetailProduct,
} = require("../controllers/detailsProducts.controller");

// 🟢 crear
router.post("/", createDetailProduct);

// 🔵 todos
router.get("/", getAllDetails);

// 🟣 por producto (⚠️ SIEMPRE antes de :id)
router.get("/producto/:id_producto", getDetailsByProduct);

// 🟠 uno
router.get("/:id_detalle_producto", getDetailById);

// 🟡 actualizar
router.put("/:id_detalle_producto", updateDetailProduct);

// 🔴 eliminar definitivo
router.delete("/delete/", deleteOneDetailProduct);

// 🔴 eliminar normal
router.delete("/:id_detalle_producto", deleteDetailProduct);

module.exports = router;