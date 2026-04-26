import { Vault } from "../models/Vault.js";
import {
  deleteCloudinaryAsset,
  uploadFileToCloudinary,
} from "../services/cloudinaryService.js";
import { makeVaultId, normalizeVault, toVaultMap } from "../utils/vault.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// @desc    Get health status
// @route   GET /api/health
export const getHealth = asyncHandler(async (_req, res) => {
  res.json({ success: true, message: "Vault API is running" });
});

// @desc    Get multiple vaults by IDs
// @route   GET /api/vaults?ids=id1,id2
export const getVaults = asyncHandler(async (req, res) => {
  const rawIds = typeof req.query.ids === "string" ? req.query.ids : "";
  const ids = rawIds
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!ids.length) {
    return res.json({ success: true, vaults: {} });
  }

  const vaults = await Vault.find({ vaultId: { $in: ids } }).sort({
    updatedAt: -1,
  });
  res.json({
    success: true,
    vaults: toVaultMap(vaults.map(normalizeVault)),
  });
});

// @desc    Create a new vault
// @route   POST /api/vaults
export const createVault = asyncHandler(async (req, res) => {
  const { name, password, description = "" } = req.body;

  if (!name || !password) {
    res.status(400);
    throw new Error("Name and password are required");
  }

  let vaultId = makeVaultId();
  // Ensure uniqueness
  while (await Vault.exists({ vaultId })) {
    vaultId = makeVaultId();
  }

  const vault = await Vault.create({
    vaultId,
    name: String(name).trim(),
    description: String(description).trim(),
    password,
    themeColor: "#ffffff",
    media: [],
  });

  res.status(201).json({
    success: true,
    vault: normalizeVault(vault),
  });
});

// @desc    Access a vault with ID and password
// @route   POST /api/vaults/access
export const accessVault = asyncHandler(async (req, res) => {
  const { vaultId, password } = req.body;

  if (!vaultId || !password) {
    res.status(400);
    throw new Error("Vault ID and password are required");
  }

  const vault = await Vault.findOne({ vaultId });
  if (!vault || vault.password !== password) {
    res.status(401);
    throw new Error("Incorrect Vault ID or password");
  }

  res.json({
    success: true,
    vault: normalizeVault(vault),
  });
});

// @desc    Update vault details
// @route   PUT /api/vaults/:vaultId
export const updateVault = asyncHandler(async (req, res) => {
  const { vaultId } = req.params;
  const { name, description, password, themeColor, media } = req.body;

  const vault = await Vault.findOne({ vaultId });
  if (!vault) {
    res.status(404);
    throw new Error("Vault not found");
  }

  if (name !== undefined) vault.name = String(name).trim();
  if (description !== undefined) vault.description = String(description).trim();
  if (password !== undefined) vault.password = password;
  if (themeColor !== undefined) vault.themeColor = themeColor;

  if (Array.isArray(media)) {
    vault.media = media.map((m) => ({
      _id: m.id,
      type: m.type,
      name: m.name,
      size: m.size,
      date: m.date,
      starred: m.starred,
      url: m.url,
      duration: m.duration,
      cloudinaryPublicId: m.cloudinaryPublicId,
    }));
  }

  await vault.save();
  res.json({
    success: true,
    vault: normalizeVault(vault),
  });
});

// @desc    Upload media to a vault
// @route   POST /api/vaults/:vaultId/media
export const uploadMedia = asyncHandler(async (req, res) => {
  const { vaultId } = req.params;

  // Quick existence check (no version stamp read)
  const exists = await Vault.exists({ vaultId });
  if (!exists) {
    res.status(404);
    throw new Error("Vault not found");
  }

  const files = req.files || [];
  if (!files.length) {
    res.status(400);
    throw new Error("No files uploaded");
  }

  // Upload to Cloudinary first (outside of any DB transaction)
  const uploads = await Promise.all(
    files.map((file) => uploadFileToCloudinary(file, vaultId)),
  );

  // Atomic prepend — does NOT read __v, so parallel requests never conflict
  const updated = await Vault.findOneAndUpdate(
    { vaultId },
    { $push: { media: { $each: uploads, $position: 0 } } },
    { new: true },
  );

  if (!updated) {
    res.status(404);
    throw new Error("Vault not found after upload");
  }

  res.json({
    success: true,
    vault: normalizeVault(updated),
  });
});

// @desc    Toggle star on media item
// @route   PATCH /api/vaults/:vaultId/media/:mediaId/star
export const toggleStar = asyncHandler(async (req, res) => {
  const { vaultId, mediaId } = req.params;
  const vault = await Vault.findOne({ vaultId });
  if (!vault) {
    res.status(404);
    throw new Error("Vault not found");
  }

  const mediaItem = vault.media.id(mediaId);
  if (!mediaItem) {
    res.status(404);
    throw new Error("Media not found");
  }

  mediaItem.starred = !mediaItem.starred;
  await vault.save();

  res.json({
    success: true,
    vault: normalizeVault(vault),
  });
});

// @desc    Delete specific media items
// @route   DELETE /api/vaults/:vaultId/media
export const deleteMedia = asyncHandler(async (req, res) => {
  const { vaultId } = req.params;
  const { ids = [] } = req.body;

  const vault = await Vault.findOne({ vaultId });
  if (!vault) {
    res.status(404);
    throw new Error("Vault not found");
  }

  const removeSet = new Set(ids.map((id) => id.toString()));
  const removed = vault.media.filter((m) => removeSet.has(m._id.toString()));

  // Delete from Cloudinary
  for (const mediaItem of removed) {
    if (mediaItem.cloudinaryPublicId) {
      await deleteCloudinaryAsset(mediaItem.cloudinaryPublicId, mediaItem.type);
    }
  }

  vault.media = vault.media.filter((m) => !removeSet.has(m._id.toString()));
  await vault.save();

  res.json({
    success: true,
    vault: normalizeVault(vault),
  });
});

// @desc    Clear all media from a vault
// @route   DELETE /api/vaults/:vaultId/all-media
export const clearAllMedia = asyncHandler(async (req, res) => {
  const { vaultId } = req.params;
  const vault = await Vault.findOne({ vaultId });
  if (!vault) {
    res.status(404);
    throw new Error("Vault not found");
  }

  // Delete all from Cloudinary
  for (const mediaItem of vault.media) {
    if (mediaItem.cloudinaryPublicId) {
      await deleteCloudinaryAsset(mediaItem.cloudinaryPublicId, mediaItem.type);
    }
  }

  vault.media = [];
  await vault.save();

  res.json({
    success: true,
    vault: normalizeVault(vault),
  });
});

// @desc    Destroy an entire vault
// @route   DELETE /api/vaults/:vaultId
export const destroyVault = asyncHandler(async (req, res) => {
  const { vaultId } = req.params;
  const vault = await Vault.findOne({ vaultId });
  if (!vault) {
    res.status(404);
    throw new Error("Vault not found");
  }

  // Delete all assets from Cloudinary
  for (const mediaItem of vault.media) {
    if (mediaItem.cloudinaryPublicId) {
      await deleteCloudinaryAsset(mediaItem.cloudinaryPublicId, mediaItem.type);
    }
  }

  await vault.deleteOne();
  res.json({ success: true, message: "Vault destroyed" });
});
