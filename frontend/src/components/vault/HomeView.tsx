import { useState } from 'react';
import { Search, X, Lock, ChevronRight, Plus, Unlock } from 'lucide-react';
import type { VaultMap, ViewState } from './types';

interface HomeViewProps {
  vaults: VaultMap;
  onOpenVault: (id: string) => void;
  onNavigate: (view: ViewState) => void;
}

export function HomeView({ vaults, onOpenVault, onNavigate }: HomeViewProps) {
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const vaultEntries = Object.entries(vaults).filter(([id, v]) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return v.name.toLowerCase().includes(q) || id.toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-vault-border">
        <span className="text-sm font-semibold tracking-tight text-vault-text">VaultDrop</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="w-9 h-9 flex items-center justify-center text-vault-text hover:bg-vault-elevated transition-colors"
          >
            <Search size={18} />
          </button>
          <button
            onClick={() => onNavigate('access')}
            className="w-9 h-9 flex items-center justify-center text-vault-text hover:bg-vault-elevated transition-colors"
          >
            <Unlock size={18} />
          </button>
          <button
            onClick={() => onNavigate('create')}
            className="w-9 h-9 flex items-center justify-center text-vault-text hover:bg-vault-elevated transition-colors"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="px-4 py-3 border-b border-vault-border">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-vault-muted" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search vaults..."
              className="w-full pl-9 pr-9 py-2 bg-vault-elevated border border-vault-border text-vault-text text-sm placeholder:text-vault-muted focus:border-vault-muted focus:outline-none transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-vault-muted">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Vault list */}
      <div className="flex-1 overflow-y-auto">
        {vaultEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
            <Lock size={24} className="text-vault-muted mb-4" />
            <p className="text-sm text-vault-muted">No vaults yet</p>
            <button
              onClick={() => onNavigate('create')}
              className="mt-4 px-4 py-2 text-sm bg-vault-accent text-vault-bg font-medium hover:opacity-90 transition-opacity"
            >
              Create vault
            </button>
          </div>
        ) : (
          <div>
            {vaultEntries.map(([id, vault]) => {
              const totalItems = vault.media.length;
              return (
                <button
                  key={id}
                  onClick={() => onOpenVault(id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-vault-border hover:bg-vault-elevated transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-vault-elevated border border-vault-border flex items-center justify-center flex-shrink-0">
                    <Lock size={16} className="text-vault-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-vault-text block truncate">{vault.name}</span>
                    <span className="text-xs text-vault-muted">{totalItems} {totalItems === 1 ? 'item' : 'items'}</span>
                  </div>
                  <ChevronRight size={16} className="text-vault-muted flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
