require("dotenv").config();
const fs = require("fs/promises");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const safeUnlink = async (filePath) => {
  if (!filePath) return;

  try {
    await fs.unlink(filePath);
  } catch (_) {}
};

const uploadImageFileToCloudinary = async (filePath, options = {}) => {
  if (!filePath) return null;

  const {
    folder = "kajamart/uploads",
    resource_type = "image",
    ...restOptions
  } = options;

  return cloudinary.uploader.upload(filePath, {
    folder,
    resource_type,
    ...restOptions,
  });
};

module.exports = {
  cloudinary,
  safeUnlink,
  uploadImageFileToCloudinary,
};
