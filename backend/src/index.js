const prisma = require("./prisma/prismaClient");
const express = require("express");
const fs = require("fs");
const cors = require("cors");
const routes = require("./routes/index");
const app = express();

const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.use(routes);
app.listen(port, () => {
    console.log(`Server running on port http://localhost:${port}`);
});