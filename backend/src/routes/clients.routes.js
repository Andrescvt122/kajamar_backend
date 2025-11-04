const express = require("express");
const router = express.Router();
const clientController = require("../controllers/clients.controller"); // ← Nombre exacto del archivo

// GET /api/clients → Obtener todos los clientes
router.get("/", clientController.getClients);

// GET /api/clients/:id → Obtener un cliente por ID
router.get("/:id", clientController.getClientById);

// POST /api/clients → Crear un nuevo cliente
router.post("/", clientController.createClient);

// PUT /api/clients/:id → Actualizar un cliente
router.put("/:id", clientController.updateClient);

// DELETE /api/clients/:id → Eliminar un cliente
router.delete("/:id", clientController.deleteClient);

module.exports = router;