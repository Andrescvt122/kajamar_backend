const express = require("express");
const router = express.Router();
//importa tus de tu propio archivo de rutas amiguito
const categoriesRoutes = require("./categories.routes");
const lowProductsRoutes = require("./lowProducts.routes");
const searchRoutes = require("./search.routes");
const suppliersRoutes = require("./suppliers.routes");
const productsRoutes = require("./products.routes");


//usas tus rutas
//llama tus rutas con el prejito /kajamart/api/<nombre de la ruta>

router.use("/kajamart/api/categories", categoriesRoutes);
router.use("/kajamart/api/products", productsRoutes);
router.use("/kajamart/api/lowProducts", lowProductsRoutes);
router.use("/kajamart/api/search", searchRoutes);
router.use("/kajamart/api/suppliers", suppliersRoutes);

module.exports = router;
