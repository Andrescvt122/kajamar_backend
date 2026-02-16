const express = require("express");
const router = express.Router();
const clientsController = require("../controllers/clients.controller");

// GET /kajamart/api/clients
router.get("/", clientsController.getClients);

// GET /kajamart/api/clients/search/:q
router.get("/search/:q", clientsController.searchClients);

// GET /kajamart/api/clients/:id
router.get("/:id", clientsController.getClientById);

// POST /kajamart/api/clients
router.post("/", clientsController.createClient);

// PUT /kajamart/api/clients/:id
router.put("/:id", clientsController.updateClient);

// DELETE /kajamart/api/clients/:id
router.delete("/:id", clientsController.deleteClient);

module.exports = router;
