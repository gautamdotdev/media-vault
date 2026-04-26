export const makeVaultId = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const seg = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `VAULT-${seg()}-${seg()}`;
};

export const makeShareCode = () => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

export const normalizeVault = (vaultDoc) => {
  const vault = vaultDoc.toObject();
  return {
    id: vault.vaultId,
    name: vault.name,
    description: vault.description,
    password: vault.password,
    themeColor: vault.themeColor,
    shareCode: vault.shareCode,
    shareEnabled: vault.shareEnabled,
    shareConfig: vault.shareConfig || { type: "full", sharedIds: [] },
    media: vault.media.map((m) => ({
      id: m._id.toString(),
      type: m.type,
      name: m.name,
      size: m.size,
      date: m.date,
      starred: m.starred,
      url: m.url,
      duration: m.duration,
      cloudinaryPublicId: m.cloudinaryPublicId
    })),
  };
};

export const normalizeSharedVault = (vaultDoc) => {
  const vault = vaultDoc.toObject();
  const config = vault.shareConfig || { type: "full", sharedIds: [] };
  
  let media = vault.media;
  if (config.type === "selected") {
    media = media.filter(m => config.sharedIds.includes(m._id.toString()));
  }

  return {
    name: vault.name,
    description: vault.description,
    themeColor: vault.themeColor,
    media: media.map((m) => ({
      id: m._id.toString(),
      type: m.type,
      name: m.name,
      size: m.size,
      date: m.date,
      starred: m.starred,
      url: m.url,
      duration: m.duration,
    })),
  };
};

export const toVaultMap = (vaults) =>
  vaults.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});
