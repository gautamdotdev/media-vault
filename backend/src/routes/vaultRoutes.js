import express from "express";
import multer from "multer";
import {
  accessVault,
  clearAllMedia,
  createVault,
  deleteMedia,
  destroyVault,
  getHealth,
  getVaults,
  toggleStar,
  updateVault,
  uploadMedia,
} from "../controllers/vaultController.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB per file
});

router.get("/health", getHealth);
router.get("/vaults", getVaults);
router.post("/vaults", createVault);
router.post("/vaults/access", accessVault);
router.put("/vaults/:vaultId", updateVault);
router.post("/vaults/:vaultId/media", upload.array("files"), uploadMedia);
router.patch("/vaults/:vaultId/media/:mediaId/star", toggleStar);
router.delete("/vaults/:vaultId/media", deleteMedia);
router.delete("/vaults/:vaultId/all-media", clearAllMedia);
router.delete("/vaults/:vaultId", destroyVault);

export { router as vaultRoutes };
