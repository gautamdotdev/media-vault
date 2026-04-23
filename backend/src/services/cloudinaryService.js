import { cloudinary } from "../config/cloudinary.js";

/**
 * Uploads a file buffer to Cloudinary
 * @param {Object} file - Multer file object
 * @param {string} vaultId - The ID of the vault (used for folder path)
 * @returns {Promise<Object>} - Normalized media object
 */
export const uploadFileToCloudinary = (file, vaultId) =>
  new Promise((resolve, reject) => {
    const isVideo = String(file.mimetype).startsWith("video/");
    
    const uploadOptions = {
      resource_type: isVideo ? "video" : "image",
      folder: `media-vault/${vaultId}`,
      use_filename: true,
      unique_filename: true,
    };


    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (err, result) => {
        if (err || !result) {
          console.error("Cloudinary upload error:", err);
          return reject(new Error(err?.message || "Cloudinary upload failed"));
        }

        resolve({
          type: isVideo ? "video" : "image",
          name: file.originalname,
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          date: new Date().toISOString(),
          starred: false,
          url: result.secure_url,
          duration: isVideo && result.duration ? `${Math.round(result.duration)}s` : undefined,
          cloudinaryPublicId: result.public_id,
        });
      }
    );

    stream.end(file.buffer);
  });

/**
 * Deletes an asset from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @param {string} mediaType - "image" or "video"
 */
export const deleteCloudinaryAsset = async (publicId, mediaType) => {
  if (!publicId) return;
  
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: mediaType === "video" ? "video" : "image",
    });
  } catch (err) {
    console.error(`Failed to delete Cloudinary asset ${publicId}:`, err);
    // We don't necessarily want to crash the request if a delete fails, 
    // but logging it is important.
  }
};

