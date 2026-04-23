import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Unlock, Eye, EyeOff, Loader2, Plus } from 'lucide-react';
import { useToast } from './Toast';
import type { VaultMap, ViewState } from './types';

interface Props {
  onBack: () => void;
  onUnlock: (id: string, password?: string) => Promise<void> | void;
  onNavigate: (view: ViewState) => void;
  vaults: VaultMap;
}

export function AccessVaultView({ onBack, onUnlock, onNavigate, vaults }: Props) {
  const [vaultId, setVaultId] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const { showToast } = useToast();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleUnlock = () => {
    if (cooldown > 0) return;
    setLoading(true);
    setError('');
    setTimeout(async () => {
      setLoading(false);
      try {
        showToast('success', 'Vault unlocked');
        await onUnlock(vaultId, password);
      } catch {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setError('Incorrect Vault ID or password.');
        setShake(true);
        setTimeout(() => setShake(false), 500);
        if (newAttempts >= 3) {
          setCooldown(30);
          setAttempts(0);
        }
      }
    }, 1200);
  };

  const recentVaults = Object.entries(vaults).slice(0, 3);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 h-14 border-b border-vault-border">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center text-vault-text hover:bg-vault-elevated transition-colors">
          <ArrowLeft size={20} />
        </button>
        <span className="text-sm font-medium text-vault-text flex-1">Access vault</span>
        <button
          onClick={() => onNavigate('create')}
          className="text-xs text-vault-muted hover:text-vault-text transition-colors flex items-center gap-1"
        >
          <Plus size={16} /> New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-8">
        <div className="max-w-sm mx-auto space-y-5">
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-3 border border-vault-danger/30 bg-vault-danger/5 text-sm text-vault-danger"
            >
              {error}
            </motion.div>
          )}

          {cooldown > 0 && (
            <div className="p-3 border border-vault-warning/30 bg-vault-warning/5 text-sm text-vault-warning">
              Too many attempts. Wait {cooldown}s.
            </div>
          )}

          <motion.div
            animate={shake ? { x: [0, -8, 8, -8, 8, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="space-y-4"
          >
            <div>
              <label className="text-xs font-medium text-vault-muted mb-1.5 block uppercase tracking-wider">Vault ID</label>
              <input
                value={vaultId}
                onChange={e => setVaultId(e.target.value.toUpperCase())}
                placeholder="VAULT-XXXX-XXXX"
                className="w-full px-3 py-2.5 bg-vault-surface border border-vault-border text-vault-text font-mono text-sm placeholder:text-vault-muted/40 focus:border-vault-muted focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-vault-muted mb-1.5 block uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter vault password"
                  className="w-full px-3 py-2.5 pr-10 bg-vault-surface border border-vault-border text-vault-text text-sm placeholder:text-vault-muted/40 focus:border-vault-muted focus:outline-none transition-colors"
                  onKeyDown={e => e.key === 'Enter' && vaultId && password && handleUnlock()}
                />
                <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-vault-muted hover:text-vault-text">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              onClick={handleUnlock}
              disabled={loading || cooldown > 0 || !vaultId || !password}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-vault-accent text-vault-bg text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Unlock size={16} />}
              {loading ? 'Unlocking...' : 'Unlock'}
            </button>
          </motion.div>

          {recentVaults.length > 0 && (
            <div className="pt-6 border-t border-vault-border">
              <p className="text-xs text-vault-muted uppercase tracking-wider mb-3">Recent</p>
              <div className="space-y-1">
                {recentVaults.map(([id, v]) => (
                  <button
                    key={id}
                    onClick={() => setVaultId(id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 border border-vault-border hover:bg-vault-elevated transition-colors text-left"
                  >
                    <span className="text-sm text-vault-text">{v.name}</span>
                    <span className="text-xs font-mono text-vault-muted">{id.slice(0, 9)}…</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
