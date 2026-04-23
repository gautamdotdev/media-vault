import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HomeView } from '@/components/vault/HomeView';
import { CreateVaultView } from '@/components/vault/CreateVaultView';
import { AccessVaultView } from '@/components/vault/AccessVaultView';
import { VaultInteriorView } from '@/components/vault/VaultInteriorView';
import { ToastProvider } from '@/components/vault/Toast';
import { api } from '@/lib/api';
import type { ViewState, VaultMap } from '@/components/vault/types';
import './App.css';

const KNOWN_VAULT_IDS_KEY = 'vaultdrop-known-vault-ids';

export default function App() {
  const [view, setView] = useState<ViewState>('home');
  const [theme, setTheme] = useState('dark');
  const [vaults, setVaults] = useState<VaultMap>({});
  const [activeVaultId, setActiveVaultId] = useState<string | null>(null);
  const [knownVaultIds, setKnownVaultIds] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('vaultdrop-theme');
    if (saved) setTheme(saved);
    const savedVaultIds = localStorage.getItem(KNOWN_VAULT_IDS_KEY);
    if (savedVaultIds) {
      try {
        const parsed = JSON.parse(savedVaultIds);
        if (Array.isArray(parsed)) {
          setKnownVaultIds(parsed.filter((item): item is string => typeof item === 'string'));
        }
      } catch (error) {
        console.error(error);
      }
    }
  }, []);

  useEffect(() => {
    document.documentElement.className = theme;
    localStorage.setItem('vaultdrop-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(KNOWN_VAULT_IDS_KEY, JSON.stringify(knownVaultIds));
  }, [knownVaultIds]);

  useEffect(() => {
    const loadVaults = async () => {
      try {
        const list = await api.getVaults(knownVaultIds);
        setVaults(list);
      } catch (error) {
        console.error(error);
      }
    };
    loadVaults();
  }, [knownVaultIds]);

  const rememberVault = (id: string) => {
    setKnownVaultIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const handleOpenVault = async (id: string, password?: string) => {
    if (password) {
      const unlocked = await api.accessVault(id, password);
      setVaults((prev) => ({ ...prev, [id]: unlocked }));
      rememberVault(id);
    }
    setActiveVaultId(id);
    setView('vault-open');
  };

  const handleLock = () => {
    setActiveVaultId(null);
    setView('home');
  };

  return (
    <ToastProvider>
      <div className="h-screen flex flex-col bg-vault-bg text-vault-text overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="h-full"
            >
              {view === 'home' && (
                <HomeView vaults={vaults} onOpenVault={handleOpenVault} onNavigate={setView} />
              )}
              {view === 'create' && (
                <CreateVaultView
                  onBack={() => setView('home')}
                  onOpenVault={handleOpenVault}
                  onVaultCreated={rememberVault}
                  vaults={vaults}
                  setVaults={setVaults}
                />
              )}
              {view === 'access' && (
                <AccessVaultView onBack={() => setView('home')} onUnlock={handleOpenVault} onNavigate={setView} vaults={vaults} />
              )}
              {view === 'vault-open' && activeVaultId && vaults[activeVaultId] && (
                <VaultInteriorView
                  vaultId={activeVaultId}
                  vault={vaults[activeVaultId]}
                  onLock={handleLock}
                  onUpdateVault={async (v) => {
                    const saved = await api.saveVault(activeVaultId, v);
                    setVaults({ ...vaults, [activeVaultId]: saved });
                  }}
                  theme={theme}
                  setTheme={setTheme}
                  onDeleteVault={async () => {
                    await api.deleteVault(activeVaultId);
                    const next = { ...vaults };
                    delete next[activeVaultId];
                    setVaults(next);
                    setKnownVaultIds((prev) => prev.filter((id) => id !== activeVaultId));
                    handleLock();
                  }}
                  onClearAllMedia={async () => {
                    const cleared = await api.clearAllMedia(activeVaultId);
                    setVaults({ ...vaults, [activeVaultId]: cleared });
                  }}
                  onRemoveMedia={async (ids) => {
                    const updated = await api.removeMedia(activeVaultId, ids);
                    setVaults({ ...vaults, [activeVaultId]: updated });
                  }}
                  onToggleStar={async (mediaId) => {
                    const updated = await api.toggleStar(activeVaultId, mediaId);
                    setVaults({ ...vaults, [activeVaultId]: updated });
                  }}
                  onUploadMedia={async (files) => {
                    const updated = await api.uploadMedia(activeVaultId, files);
                    setVaults({ ...vaults, [activeVaultId]: updated });
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </ToastProvider>
  );
}
