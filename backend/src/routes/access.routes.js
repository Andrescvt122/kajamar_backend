// access.routes.js

const express = require('express');
const router = express.Router();
// Changed to accessController to match the file name and functions
const accessController = require('../controllers/access.controller'); 

// GET /access
router.get('/', accessController.getAccesses); 
// GET /access/:id
router.get('/:id', accessController.getAccessById); 
// POST /access
router.post('/', accessController.createAccess);
// PUT /access/:id
router.put('/:id', accessController.updateAccess); 
// DELETE /access/:id
router.delete('/:id', accessController.deleteAccess); 

module.exports = router;