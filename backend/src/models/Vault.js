import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["image", "video"], required: true },
    name: { type: String, required: true },
    size: { type: String, required: true },
    date: { type: String, required: true },
    starred: { type: Boolean, default: false },
    url: { type: String, default: null },
    duration: { type: String, default: undefined },
    cloudinaryPublicId: { type: String, default: null },
  },
  { timestamps: true, bufferCommands: false },
);

const vaultSchema = new mongoose.Schema(
  {
    vaultId: { type: String, unique: true, index: true, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    password: { type: String, required: true },
    themeColor: { type: String, default: "#ffffff" },
    media: [mediaSchema],
    shareCode: { type: String, unique: true, sparse: true, index: true },
    shareEnabled: { type: Boolean, default: false },
    shareConfig: {
      type: { type: String, enum: ["full", "selected"], default: "full" },
      sharedIds: [{ type: String }],
    },
  },
  { timestamps: true, bufferCommands: false },
);

export const Vault = mongoose.model("Vault", vaultSchema);
