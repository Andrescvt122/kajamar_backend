// roles.routes.js

const express = require('express');
const router = express.Router();
// Assuming the controller is named 'rolesController'
const rolesController = require('../controllers/roles.controller'); 
router.get('/', rolesController.getRoles);
router.get('/:id', rolesController.getRoleById);
router.post('/', rolesController.createRole);
router.put('/:id', rolesController.updateRole);
router.delete('/:id', rolesController.deleteRole);

module.exports = router;