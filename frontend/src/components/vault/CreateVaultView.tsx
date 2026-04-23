import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Check, X } from 'lucide-react';
import { PasswordStrengthMeter, getStrength } from './PasswordStrengthMeter';
import { CopyChip } from './CopyChip';
import { useToast } from './Toast';
import { api } from '@/lib/api';
import type { VaultMap } from './types';

interface Props {
  onBack: () => void;
  onOpenVault: (id: string) => void;
  onVaultCreated: (id: string) => void;
  vaults: VaultMap;
  setVaults: (v: VaultMap) => void;
}

export function CreateVaultView({ onBack, onOpenVault, onVaultCreated, vaults, setVaults }: Props) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { showToast } = useToast();

  const strength = getStrength(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const canSubmit = name.trim().length > 0 && strength >= 3 && passwordsMatch;

  const handleCreate = async () => {
    try {
      setCreating(true);
      const createdVault = await api.createVault({ name: name.trim(), password });
      setVaults({
        ...vaults,
        [createdVault.id]: createdVault,
      });
      onVaultCreated(createdVault.id);
      setCreatedId(createdVault.id);
      showToast('success', 'Vault created');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Failed to create vault');
    } finally {
      setCreating(false);
    }
  };

  if (createdId) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-vault-border">
           <button onClick={onBack} className="w-9 h-9 flex items-center justify-center text-vault-text hover:bg-vault-elevated transition-colors">
            <ArrowLeft size={20} />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-sm w-full text-center">
             <div className="w-10 h-10 border border-vault-success/40 flex items-center justify-center mx-auto mb-5">
              <Check size={20} className="text-vault-success" />
            </div>
            <p className="text-sm font-medium text-vault-text mb-1">Vault created</p>
            <p className="text-xs text-vault-muted mb-4">Save your Vault ID and password. They cannot be recovered.</p>
            <div className="flex justify-center mb-6">
              <CopyChip text={createdId} />
            </div>
            <div className="space-y-2">
              <button onClick={() => onOpenVault(createdId)} className="w-full py-2.5 bg-vault-accent text-vault-bg text-sm font-medium hover:opacity-90 transition-opacity">
                Open vault
              </button>
              <button onClick={onBack} className="w-full py-2.5 border border-vault-border text-vault-text text-sm hover:bg-vault-elevated transition-colors">
                Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 h-14 border-b border-vault-border">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center text-vault-text hover:bg-vault-elevated transition-colors">
          <ArrowLeft size={20} />
        </button>
        <span className="text-sm font-medium text-vault-text">New vault</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-8">
        <div className="max-w-sm mx-auto space-y-5">
          <div>
            <label className="text-xs font-medium text-vault-muted mb-1.5 block uppercase tracking-wider">Name</label>
            <div className="relative">
              <input
                value={name}
                onChange={e => setName(e.target.value.slice(0, 40))}
                placeholder="e.g. Family Trip 2025"
                className="w-full px-3 py-2.5 bg-vault-surface border border-vault-border text-vault-text text-sm placeholder:text-vault-muted/40 focus:border-vault-muted focus:outline-none transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-vault-muted">{name.length}/40</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-vault-muted mb-1.5 block uppercase tracking-wider">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Strong password"
                className="w-full px-3 py-2.5 pr-10 bg-vault-surface border border-vault-border text-vault-text text-sm placeholder:text-vault-muted/40 focus:border-vault-muted focus:outline-none transition-colors"
              />
              <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-vault-muted hover:text-vault-text">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {password.length > 0 && (
              <div className="mt-2">
                <PasswordStrengthMeter password={password} />
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-vault-muted mb-1.5 block uppercase tracking-wider">Confirm password</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full px-3 py-2.5 pr-14 bg-vault-surface border border-vault-border text-vault-text text-sm placeholder:text-vault-muted/40 focus:border-vault-muted focus:outline-none transition-colors"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {confirmPassword.length > 0 && (
                  passwordsMatch
                    ? <Check size={14} className="text-vault-success" />
                    : <X size={14} className="text-vault-danger" />
                )}
                <button onClick={() => setShowConfirm(!showConfirm)} className="text-vault-muted hover:text-vault-text">
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={!canSubmit || creating}
            className="w-full py-2.5 bg-vault-accent text-vault-bg text-sm font-medium disabled:opacity-20 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {creating ? 'Creating...' : 'Create vault'}
          </button>
        </div>
      </div>
    </div>
  );
}
