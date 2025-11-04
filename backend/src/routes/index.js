const express = require("express");
const router = express.Router();

const categoriesRoutes = require("./categories.routes");
const lowProductsRoutes = require("./lowProducts.routes");
const searchRoutes = require("./search.routes");
const usersRoutes = require("./users.routes");
const rolesRoutes = require("./roles.routes");
const accessRoutes = require("./access.routes");
const returnProductsRoutes = require("./returnProducts.routes");
const clientsRoutes = require("./clients.routes"); // 👈 Agregado

router.use("/kajamart/api/categories", categoriesRoutes);
router.use("/kajamart/api/lowProducts", lowProductsRoutes);
router.use("/kajamart/api/search", searchRoutes);
router.use("/kajamart/api/users", usersRoutes);
router.use("/kajamart/api/roles", rolesRoutes);
router.use("/kajamart/api/roles", accessRoutes);
router.use("/kajamart/api/returnProducts", returnProductsRoutes);
router.use("/kajamart/api/clients", clientsRoutes); // 👈 Agregado
module.exports = router;