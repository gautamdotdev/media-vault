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

  async uploadMedia(
    vaultId: string,
    files: File[],
    onProgress?: (fileIndex: number, percent: number, bytesLoaded: number, bytesTotal: number) => void,
  ): Promise<Vault> {
    /** Upload a single file with retry support */
    const uploadOne = (file: File, index: number, attempt = 0): Promise<Vault> =>
      new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append("files", file);

        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable && onProgress) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(index, percent, event.loaded, event.total);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              onProgress?.(index, 100, file.size, file.size);
              resolve(data.vault);
            } catch {
              reject(new Error("Failed to parse response"));
            }
          } else {
            // Parse JSON error body from the server for a user-friendly message
            let errMsg = xhr.statusText || `Upload failed (HTTP ${xhr.status})`;
            try {
              const errData = JSON.parse(xhr.responseText);
              if (errData.message) errMsg = errData.message;
            } catch { /* ignore parse failures */ }

            // Don't retry client errors (4xx) — they'll always fail
            const isClientError = xhr.status >= 400 && xhr.status < 500;
            if (attempt < 1 && !isClientError) {
              setTimeout(() => uploadOne(file, index, attempt + 1).then(resolve, reject), 1500);
            } else {
              reject(new Error(errMsg));
            }
          }
        });

        xhr.addEventListener("error", () => {
          if (attempt < 1) {
            setTimeout(() => uploadOne(file, index, attempt + 1).then(resolve, reject), 1500);
          } else {
            reject(new Error("Network error"));
          }
        });

        xhr.open("POST", `${API_BASE_URL}/api/vaults/${vaultId}/media`);
        xhr.send(formData);
      });

    // Upload all files concurrently and return the last vault state (most up-to-date after all uploads)
    const results = await Promise.all(files.map((file, idx) => uploadOne(file, idx)));
    // The last resolved vault will have all previously uploaded items since the server appends them;
    // however since uploads are concurrent we can't guarantee order. Merge all media from all results.
    const allMedia = results.flatMap((v) => v.media);
    const seen = new Set<string>();
    const mergedMedia = allMedia.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
    return { ...results[results.length - 1], media: mergedMedia };
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

  async updateShareSettings(
    vaultId: string,
    payload: { shareEnabled: boolean; shareConfig?: { type: "full" | "selected"; sharedIds: string[] } },
  ): Promise<{ shareCode: string; shareEnabled: boolean; shareConfig: any }> {
    return request(`/api/vaults/${vaultId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  async getSharedVault(shareCode: string): Promise<{ vault: Vault }> {
    return request(`/api/public/vault/${shareCode}`);
  },
};
