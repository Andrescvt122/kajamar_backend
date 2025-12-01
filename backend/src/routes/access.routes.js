// access.routes.js

const express = require('express');
const router = express.Router();
// Changed to accessController to match the file name and functions
const accessController = require('../controllers/access.controller'); 

router.get('/', accessController.getAccesses); 
router.get('/:id', accessController.getAccessById); 
router.post('/', accessController.createAccess);
router.put('/:id', accessController.updateAccess); 
router.delete('/:id', accessController.deleteAccess); 

module.exports = router;