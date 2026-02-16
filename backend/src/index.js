// src/index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const routes = require("./routes/index");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Todas las rutas con prefijos /kajamart/api/...
app.use(routes);
app.use("/kajamart/api", require("./routes/sales.routes"));

app.listen(port, () => {
  console.log(`Server running on port http://localhost:${port}`);
});
