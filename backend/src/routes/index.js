// src/routes/index.js
const express = require("express");
const router = express.Router();

// Importaciones
const authRoutes = require("./auth.routes"); // <--- IMPORTANTE
const accessRoutes = require("./access.routes");
const usersRoutes = require("./users.routes");
const rolesRoutes = require("./roles.routes");
const clientsRoutes = require("./clients.routes");
const salesRoutes = require("./sales.routes");
const categoriesRoutes = require("./categories.routes");
const productsRoutes = require("./products.routes");
const lowProductsRoutes = require("./lowProducts.routes");
const searchRoutes = require("./search.routes");
const suppliersRoutes = require("./suppliers.routes");
const returnProductsRoutes = require("./returnProducts.routes");
const detailsProductsRoutes = require("./detailsProducts.routes");
const permisosRoutes = require("./permisos.routes");
const purchaseRoutes = require("./purchase.routes");

// Definición de Rutas (LIMPIO Y SIN DUPLICADOS)
router.use("/kajamart/api/auth", authRoutes);       // Login y Recuperación
router.use("/kajamart/api/acceso", accessRoutes);   // Gestión de accesos
router.use("/kajamart/api/users", usersRoutes);     // Usuarios
router.use("/kajamart/api/roles", rolesRoutes);     // Roles
router.use("/kajamart/api/clients", clientsRoutes);
router.use("/kajamart/api/sales", salesRoutes);
router.use("/kajamart/api/categories", categoriesRoutes);
router.use("/kajamart/api/products", productsRoutes);
router.use("/kajamart/api/lowProducts", lowProductsRoutes);
router.use("/kajamart/api/search", searchRoutes);
router.use("/kajamart/api/suppliers", suppliersRoutes);
router.use("/kajamart/api/returnProducts", returnProductsRoutes);
router.use("/kajamart/api/detailsProducts", detailsProductsRoutes);
router.use("/kajamart/api/permisos", permisosRoutes);
router.use("/kajamart/api/purchase", purchaseRoutes);

module.exports = router;