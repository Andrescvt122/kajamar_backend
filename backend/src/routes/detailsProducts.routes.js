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

router.post("/", createDetailProduct);
router.get("/", getAllDetails);
router.get("/producto/:id_producto", getDetailsByProduct);
router.get("/:id_detalle_producto", getDetailById);
router.put("/:id_detalle_producto", updateDetailProduct);
router.delete("/delete/", deleteOneDetailProduct);
router.delete("/:id_detalle_producto", deleteDetailProduct);
module.exports = router;
    