const express = require('express');
const router = express.Router();
const reeturnClientController = require('../controllers/returnClient.controller');

router.get('/', reeturnClientController.getReturnClients);

module.exports = router;