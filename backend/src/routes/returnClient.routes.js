const express = require('express');
const router = express.Router();
const reeturnClientController = require('../controllers/returnClient.controller');

router.get('/', reeturnClientController.getReturnClients);
router.post('/', reeturnClientController.createReturnClients);
router.patch('/:id/anular', reeturnClientController.anularReturnClient);

module.exports = router;
