// backend/src/index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const routes = require("./routes/index");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// ✅ Sirve: backend/src/uploads  =>  http://localhost:3000/uploads/<archivo>
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Todas las rutas ya vienen con /kajamart/api/...
app.use(routes);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
