// kajamar_backend/backend/src/utils/removeBackground.js
require("dotenv").config();
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

// ✅ node-fetch v3 es ESM: lo cargamos con import dinámico
const fetchFn = async (...args) => {
  const mod = await import("node-fetch");
  return mod.default(...args);
};

const removeImageBackground = async (inputPath) => {
  try {
    if (!process.env.REMOVEBG_API_KEY) {
      console.error("❌ Falta REMOVEBG_API_KEY en el .env");
      return null;
    }

    // asegurar carpeta uploads
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const formData = new FormData();
    formData.append("image_file", fs.createReadStream(inputPath));
    formData.append("size", "auto");

    const response = await fetchFn("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        ...formData.getHeaders(), // ✅ boundary correcto
        "X-Api-Key": process.env.REMOVEBG_API_KEY,
        Accept: "image/png",
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ remove.bg error:", response.status, errorText);
      return null;
    }

    // node-fetch v3: usamos arrayBuffer()
    const buffer = Buffer.from(await response.arrayBuffer());

    const outputPath = path.join(uploadsDir, `no-bg-${Date.now()}.png`);
    fs.writeFileSync(outputPath, buffer);

    return outputPath;
  } catch (error) {
    console.error("⚠️ remove.bg falló:", error?.message || error);
    return null;
  }
};

module.exports = { removeImageBackground };
