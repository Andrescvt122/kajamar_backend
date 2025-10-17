const express = require("express");
const router = express.Router();
//importa tus de tu propio archivo de rutas amiguito
const categoriesRoutes = require("./categories.routes");
const lowProductsRoutes = require("./lowProducts.routes");
const searchRoutes = require("./search.routes");

//usas tus rutas
//llama tus rutas con el prejito /kajamart/api/<nombre de la ruta>
//por ejemplo /kajamart/api/categories
router.use("/kajamart/api/categories", categoriesRoutes);
router.use("/kajamart/api/lowProducts", lowProductsRoutes);
router.use("/kajamart/api/search", searchRoutes);
router.use("/kajamart/api/lowProducts", lowProductsRoutes);

module.exports = router;
