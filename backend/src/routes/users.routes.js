// users.routes.js

const express = require('express');
const router = express.Router();
// Assuming the controller is named 'usersController'
const usersController = require('../controllers/users.controller'); 

// GET /users - Gets all users
router.get('/', usersController.getUsers);

// GET /users/:id - Gets a user by ID
router.get('/:id', usersController.getUserById);

// POST /users - Creates a new user
router.post('/', usersController.createUser);

// PUT /users/:id - Updates a user
router.put('/:id', usersController.updateUser);

// DELETE /users/:id - Deletes a user
router.delete('/:id', usersController.deleteUser);

module.exports = router;