export const makeVaultId = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const seg = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `VAULT-${seg()}-${seg()}`;
};

export const normalizeVault = (vaultDoc) => {
  const vault = vaultDoc.toObject();
  return {
    id: vault.vaultId,
    name: vault.name,
    description: vault.description,
    password: vault.password,
    themeColor: vault.themeColor,
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


export const toVaultMap = (vaults) =>
  vaults.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});
