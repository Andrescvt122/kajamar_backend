const express = require("express");
const router = express.Router();
const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllCategories,
  searchCategories,
} = require("../controllers/categories.controller");

router.get("/", getCategories);
router.get("/all", getAllCategories);
router.get("/search", searchCategories);
router.get("/:id", getCategoryById);
router.post("/", createCategory);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);

module.exports = router;
