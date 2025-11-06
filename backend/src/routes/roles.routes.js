// roles.routes.js

const express = require('express');
const router = express.Router();
// Assuming the controller is named 'rolesController'
const rolesController = require('../controllers/roles.controller'); 

// GET /roles - Gets all roles
router.get('/', rolesController.getRoles);

// GET /roles/:id - Gets a role by ID
router.get('/:id', rolesController.getRoleById);

// POST /roles - Creates a new role
router.post('/', rolesController.createRole);

// PUT /roles/:id - Updates a role
router.put('/:id', rolesController.updateRole);

// DELETE /roles/:id - Deletes a role
router.delete('/:id', rolesController.deleteRole);

module.exports = router;