const express = require("express");
const router = express.Router();
const { getPermisos } = require("../controllers/permisos.controller");

router.get("/", getPermisos);

module.exports = router;
