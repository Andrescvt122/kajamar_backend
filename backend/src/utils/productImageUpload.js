require("dotenv").config();
const fs = require("fs/promises");
const path = require("path");
const { removeImageBackground } = require("./removeBackground");
const { cloudinary, safeUnlink } = require("./cloudinaryUpload");

const ensureUploadsDir = async () => {
  const uploadsDir = path.join(process.cwd(), "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  return uploadsDir;
};

const buildExtensionFromMime = (mime = "") => {
  const normalized = String(mime).toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  return "png";
};

const createTempFileFromDataUrl = async (dataUrl) => {
  const match = String(dataUrl || "").match(/^data:(.+?);base64,(.+)$/);
  if (!match) {
    throw new Error("Formato de imagen_base64 invalido");
  }

  const [, mime, base64Data] = match;
  const uploadsDir = await ensureUploadsDir();
  const extension = buildExtensionFromMime(mime);
  const tempPath = path.join(uploadsDir, `product-src-${Date.now()}.${extension}`);

  await fs.writeFile(tempPath, Buffer.from(base64Data, "base64"));
  return tempPath;
};

const uploadProductImageWithBgRemoval = async ({
  originalPath,
  imageBase64,
  folder = "kajamart/products",
}) => {
  let sourcePath = originalPath || null;
  let createdTempSource = false;
  let processedPath = null;

  try {
    if (!sourcePath && imageBase64) {
      sourcePath = await createTempFileFromDataUrl(imageBase64);
      createdTempSource = true;
    }

    if (!sourcePath) return { url: null, processedPath: null, sourcePath: null };

    try {
      if (typeof removeImageBackground !== "function") {
        throw new Error("removeImageBackground not available");
      }

      processedPath = await removeImageBackground(sourcePath);
      const finalPath = processedPath || sourcePath;

      const uploadResult = await cloudinary.uploader.upload(finalPath, {
        folder,
        resource_type: "image",
        format: "png",
        flags: "preserve_transparency",
      });

      return {
        url: uploadResult.secure_url,
        processedPath,
        sourcePath: createdTempSource ? sourcePath : null,
      };
    } catch (err) {
      console.error(
        "⚠️ BG removal falló, subiendo original. Motivo:",
        err?.message || err
      );

      const uploadResult = await cloudinary.uploader.upload(sourcePath, {
        folder,
        resource_type: "image",
      });

      return {
        url: uploadResult.secure_url,
        processedPath: null,
        sourcePath: createdTempSource ? sourcePath : null,
      };
    }
  } catch (error) {
    if (createdTempSource && sourcePath) {
      await safeUnlink(sourcePath);
    }
    throw error;
  }
};

module.exports = {
  uploadProductImageWithBgRemoval,
};
