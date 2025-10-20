const express = require("express");
const router = express.Router();

const categoriesRoutes = require("./categories.routes");
const lowProductsRoutes = require("./lowProducts.routes");
const searchRoutes = require("./search.routes");
const usersRoutes = require("./users.routes");
const rolesRoutes = require("./roles.routes");
const accessRoutes = require("./access.routes");


router.use("/kajamart/api/categories", categoriesRoutes);
router.use("/kajamart/api/lowProducts", lowProductsRoutes);
router.use("/kajamart/api/search", searchRoutes);
router.use("/kajamart/api/users", usersRoutes);
router.use("/kajamart/api/roles", rolesRoutes);
router.use("/kajamart/api/roles", accessRoutes)

module.exports = router;
