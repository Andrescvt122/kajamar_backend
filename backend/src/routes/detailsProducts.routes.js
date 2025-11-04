const express = require("express");
const router = express.Router();
const { createDetailProduct } = require("../controllers/detailsProducts.controller");

router.post("/", createDetailProduct);

module.exports = router;
