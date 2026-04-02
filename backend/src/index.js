require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const routes = require("./routes/index");

const app = express();
const port = process.env.PORT || process.env.SERVER_PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

app.get("/", (_req, res) => {
  res.status(200).send("ok");
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(routes);

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});