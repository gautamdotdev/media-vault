import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { HomeView } from '@/components/vault/HomeView';
import { CreateVaultView } from '@/components/vault/CreateVaultView';
import { AccessVaultView } from '@/components/vault/AccessVaultView';
import { VaultInteriorView } from '@/components/vault/VaultInteriorView';
import { ToastProvider } from '@/components/vault/Toast';
import { api } from '@/lib/api';
import type { VaultMap } from '@/components/vault/types';
import './App.css';

const KNOWN_VAULT_IDS_KEY = 'vaultdrop-known-vault-ids';
const UNLOCKED_PASSWORDS_KEY = 'vaultdrop-unlocked-passwords';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState('dark');
  const [vaults, setVaults] = useState<VaultMap>({});
  const [knownVaultIds, setKnownVaultIds] = useState<string[]>([]);
  const [unlockedPasswords, setUnlockedPasswords] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from localStorage and load vaults
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      
      const savedTheme = localStorage.getItem('vaultdrop-theme');
      if (savedTheme) setTheme(savedTheme);

      // Load known vaults
      const savedVaultIds = localStorage.getItem(KNOWN_VAULT_IDS_KEY);
      let vaultIds: string[] = [];
      if (savedVaultIds) {
        try {
          const parsed = JSON.parse(savedVaultIds);
          if (Array.isArray(parsed)) {
            vaultIds = parsed.filter((item): item is string => typeof item === 'string');
            setKnownVaultIds(vaultIds);
          }
        } catch (error) { console.error(error); }
      }

      // Load unlocked passwords
      const savedPasswords = localStorage.getItem(UNLOCKED_PASSWORDS_KEY);
      let passwords: Record<string, string> = {};
      if (savedPasswords) {
        try {
          passwords = JSON.parse(savedPasswords);
          setUnlockedPasswords(passwords);
        } catch (error) { console.error(error); }
      }

      // If we have known vaults, fetch them
      if (vaultIds.length > 0) {
        try {
          const basicVaults = await api.getVaults(vaultIds);
          const updatedVaults = { ...basicVaults };
          
          for (const id of vaultIds) {
            const password = passwords[id];
            if (password) {
              try {
                const fullVault = await api.accessVault(id, password);
                updatedVaults[id] = fullVault;
              } catch (err) {
                console.error(`Failed to re-unlock vault ${id}:`, err);
                delete passwords[id];
                localStorage.setItem(UNLOCKED_PASSWORDS_KEY, JSON.stringify(passwords));
                setUnlockedPasswords({ ...passwords });
              }
            }
          }
          setVaults(updatedVaults);
        } catch (err) {
          console.error('Failed to load vaults during init:', err);
        }
      }
      
      setIsLoading(false);
    };

    init();
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    document.documentElement.className = theme;
    localStorage.setItem('vaultdrop-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(KNOWN_VAULT_IDS_KEY, JSON.stringify(knownVaultIds));
  }, [knownVaultIds]);

  useEffect(() => {
    localStorage.setItem(UNLOCKED_PASSWORDS_KEY, JSON.stringify(unlockedPasswords));
  }, [unlockedPasswords]);

  const rememberVault = (id: string, password?: string) => {
    setKnownVaultIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    if (password) {
      setUnlockedPasswords(prev => ({ ...prev, [id]: password }));
    }
  };

  const handleOpenVault = async (id: string, password?: string) => {
    if (password) {
      const unlocked = await api.accessVault(id, password);
      setVaults((prev) => ({ ...prev, [id]: unlocked }));
      rememberVault(id, password);
    }
    navigate(`/vault/${id}`);
  };

  const handleLock = (id?: string) => {
    if (id) {
      setUnlockedPasswords(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-vault-bg text-vault-text">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-vault-accent border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium tracking-widest uppercase opacity-50">Opening Vaults...</p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="h-screen flex flex-col bg-vault-bg text-vault-text overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname.split('/')[1]}>
              <Route path="/" element={
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                  <HomeView vaults={vaults} onOpenVault={handleOpenVault} onNavigate={(v) => navigate(v === 'home' ? '/' : `/${v}`)} />
                </motion.div>
              } />
              <Route path="/create" element={
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                  <CreateVaultView
                    onBack={() => navigate('/')}
                    onOpenVault={handleOpenVault}
                    onVaultCreated={rememberVault}
                    vaults={vaults}
                    setVaults={setVaults}
                  />
                </motion.div>
              } />
              <Route path="/access" element={
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                  <AccessVaultView onBack={() => navigate('/')} onUnlock={handleOpenVault} onNavigate={(v) => navigate(`/${v}`)} vaults={vaults} />
                </motion.div>
              } />
              <Route path="/vault/:id" element={<VaultRouteWrapper vaults={vaults} onLock={handleLock} onUpdateVault={setVaults} theme={theme} setTheme={setTheme} setKnownVaultIds={setKnownVaultIds} setUnlockedPasswords={setUnlockedPasswords} onRevokeAccess={(id: string) => {
                setKnownVaultIds(prev => prev.filter(vid => vid !== id));
                setUnlockedPasswords(prev => {
                  const next = { ...prev };
                  delete next[id];
                  return next;
                });
                navigate('/');
              }} />}>
                <Route path="m/:mediaId" element={<div />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
        </div>
      </div>
    </ToastProvider>
  );
}

function VaultRouteWrapper({ vaults, onLock, onUpdateVault, theme, setTheme, setKnownVaultIds, setUnlockedPasswords, onRevokeAccess }: any) {

  const { id } = useParams();
  const navigate = useNavigate();
  const vault = vaults[id || ''];

  if (!id || !vault) {
    return <Navigate to="/" replace />;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
      <VaultInteriorView
        vaultId={id}
        vault={vault}
        onLock={() => onLock(id)}
        onRevokeAccess={() => onRevokeAccess(id)}
        onUpdateVault={async (v: any) => {
          const saved = await api.saveVault(id, v);
          onUpdateVault((prev: any) => ({ ...prev, [id]: saved }));
        }}
        theme={theme}
        setTheme={setTheme}
        onDeleteVault={async () => {
          await api.deleteVault(id);
          onUpdateVault((prev: any) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          setKnownVaultIds((prev: any) => prev.filter((vid: any) => vid !== id));
          setUnlockedPasswords((prev: any) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          navigate('/');
        }}
        onClearAllMedia={async () => {
          const cleared = await api.clearAllMedia(id);
          onUpdateVault((prev: any) => ({ ...prev, [id]: cleared }));
        }}
        onRemoveMedia={async (ids: any) => {
          const updated = await api.removeMedia(id, ids);
          onUpdateVault((prev: any) => ({ ...prev, [id]: updated }));
        }}
        onToggleStar={async (mediaId: any) => {
          const updated = await api.toggleStar(id, mediaId);
          onUpdateVault((prev: any) => ({ ...prev, [id]: updated }));
        }}
        onUploadMedia={async (files: any, onProgress?: any) => {
          const updated = await api.uploadMedia(id, files, onProgress);
          onUpdateVault((prev: any) => ({ ...prev, [id]: updated }));
        }}
      />
    </motion.div>
  );
}
