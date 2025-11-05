const express = require("express");
const router = express.Router();

const categoriesRoutes = require("./categories.routes");
const lowProductsRoutes = require("./lowProducts.routes");
const searchRoutes = require("./search.routes");
const suppliersRoutes = require("./suppliers.routes");


//usas tus rutas
//llama tus rutas con el prejito /kajamart/api/<nombre de la ruta>

router.use("/kajamart/api/categories", categoriesRoutes);
router.use("/kajamart/api/lowProducts", lowProductsRoutes);
router.use("/kajamart/api/search", searchRoutes);
router.use("/kajamart/api/suppliers", suppliersRoutes);

const usersRoutes = require("./users.routes");
const rolesRoutes = require("./roles.routes");
const accessRoutes = require("./access.routes");
const returnProductsRoutes = require("./returnProducts.routes");
const clientsRoutes = require("./clients.routes"); // 👈 Agregado
const detailsProductsRoutes = require("./detailsProducts.routes");


router.use("/kajamart/api/categories", categoriesRoutes);
router.use("/kajamart/api/lowProducts", lowProductsRoutes);
router.use("/kajamart/api/search", searchRoutes);
router.use("/kajamart/api/users", usersRoutes);
router.use("/kajamart/api/roles", rolesRoutes);
router.use("/kajamart/api/roles", accessRoutes);
router.use("/kajamart/api/returnProducts", returnProductsRoutes);
router.use("/kajamart/api/clients", clientsRoutes); // 👈 Agregado
router.use("/kajamart/api/roles", accessRoutes)
router.use("/kajamart/api/returnProducts", returnProductsRoutes)
router.use("/kajamart/api/detailsProducts", detailsProductsRoutes)
module.exports = router;
