const express = require("express");
const router = express.Router();

// ---------------------------------------------------
// 1. IMPORTACIONES DE RUTAS
// ---------------------------------------------------
const authRoutes = require("./auth.routes");            // Login, Recuperar Password (NUEVO)
const accessRoutes = require("./access.routes");        // CRUD de Accesos (Usuarios del sistema)
const usersRoutes = require("./users.routes");          // Perfiles de Usuarios
const rolesRoutes = require("./roles.routes");          // Roles
const clientsRoutes = require("./clients.routes");      // Clientes
const salesRoutes = require("./sales.routes");          // Ventas
const categoriesRoutes = require("./categories.routes");// Categorías
const productsRoutes = require("./products.routes");    // Productos
const lowProductsRoutes = require("./lowProducts.routes"); // Productos con bajo stock
const searchRoutes = require("./search.routes");        // Búsqueda global
const suppliersRoutes = require("./suppliers.routes");  // Proveedores
const returnProductsRoutes = require("./returnProducts.routes"); // Devoluciones
const detailsProductsRoutes = require("./detailsProducts.routes"); // Detalles de productos
const permisosRoutes = require("./permisos.routes");    // Permisos
const purchaseRoutes = require("./purchase.routes");    // Compras

// ---------------------------------------------------
// 2. DEFINICIÓN DE ENDPOINTS
// Base URL: http://localhost:3000/kajamart/api/...
// ---------------------------------------------------

// === AUTENTICACIÓN Y SEGURIDAD ===
router.use("/kajamart/api/auth", authRoutes);       // POST /login, /forgot-password, /reset-password
router.use("/kajamart/api/acceso", accessRoutes);   // GET, POST, PUT, DELETE usuarios admin
router.use("/kajamart/api/permisos", permisosRoutes); // Gestión de permisos
router.use("/kajamart/api/roles", rolesRoutes);     // Gestión de roles

// === GESTIÓN DEL NEGOCIO ===
router.use("/kajamart/api/users", usersRoutes);     // Datos extendidos de usuarios
router.use("/kajamart/api/clients", clientsRoutes);
router.use("/kajamart/api/sales", salesRoutes);
router.use("/kajamart/api/categories", categoriesRoutes);
router.use("/kajamart/api/products", productsRoutes);
router.use("/kajamart/api/lowProducts", lowProductsRoutes);
router.use("/kajamart/api/search", searchRoutes);
router.use("/kajamart/api/suppliers", suppliersRoutes);
router.use("/kajamart/api/returnProducts", returnProductsRoutes);
router.use("/kajamart/api/detailsProducts", detailsProductsRoutes);
router.use("/kajamart/api/purchase", purchaseRoutes);

module.exports = router;