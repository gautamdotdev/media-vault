import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface Props {
  text: string;
}

export function CopyChip({ text }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-2 px-3 py-2 border border-vault-border font-mono text-xs text-vault-text hover:bg-vault-elevated transition-colors"
    >
      <span>{text}</span>
      {copied ? <Check size={12} className="text-vault-success" /> : <Copy size={12} className="text-vault-muted" />}
    </button>
  );
}
