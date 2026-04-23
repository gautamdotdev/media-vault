import type { Vault, VaultMap } from "@/components/vault/types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${url}`, init);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Request failed");
  }
  return response.json();
};

export const api = {
  async getVaults(ids: string[]): Promise<VaultMap> {
    if (!ids.length) return {};
    const query = encodeURIComponent(ids.join(","));
    const data = await request<{ vaults: VaultMap }>(`/api/vaults?ids=${query}`);
    return data.vaults;
  },

  async createVault(payload: { name: string; password: string; description?: string }): Promise<Vault> {
    const data = await request<{ vault: Vault }>("/api/vaults", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return data.vault;
  },

  async accessVault(vaultId: string, password: string): Promise<Vault> {
    const data = await request<{ vault: Vault }>("/api/vaults/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vaultId, password }),
    });
    return data.vault;
  },

  async saveVault(vaultId: string, vault: Vault): Promise<Vault> {
    const data = await request<{ vault: Vault }>(`/api/vaults/${vaultId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vault),
    });
    return data.vault;
  },

  async uploadMedia(vaultId: string, files: File[]): Promise<Vault> {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    const data = await request<{ vault: Vault }>(`/api/vaults/${vaultId}/media`, {
      method: "POST",
      body: formData,
    });
    return data.vault;
  },

  async toggleStar(vaultId: string, mediaId: string): Promise<Vault> {
    const data = await request<{ vault: Vault }>(`/api/vaults/${vaultId}/media/${mediaId}/star`, {
      method: "PATCH",
    });
    return data.vault;
  },

  async removeMedia(vaultId: string, ids: string[]): Promise<Vault> {
    const data = await request<{ vault: Vault }>(`/api/vaults/${vaultId}/media`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    return data.vault;
  },

  async clearAllMedia(vaultId: string): Promise<Vault> {
    const data = await request<{ vault: Vault }>(`/api/vaults/${vaultId}/all-media`, {
      method: "DELETE",
    });
    return data.vault;
  },

  async deleteVault(vaultId: string): Promise<void> {
    await request(`/api/vaults/${vaultId}`, { method: "DELETE" });
  },
};
