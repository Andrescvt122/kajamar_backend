const express = require("express");
const router = express.Router();
//importa tus de tu propio archivo de rutas amiguito
const categoriesRoutes = require("./categories.routes");

//usas tus rutas
//llama tus rutas con el prejito /kajamart/api/<nombre de la ruta>
//por ejemplo /kajamart/api/categories
router.use("/kajamart/api/categories", categoriesRoutes);

module.exports = router;
