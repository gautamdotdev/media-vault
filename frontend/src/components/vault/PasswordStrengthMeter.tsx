import { Check, X } from 'lucide-react';

interface Props {
  password: string;
}

export function getStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

const labels = ['Weak', 'Fair', 'Strong', 'Fortress'];

export function PasswordStrengthMeter({ password }: Props) {
  const strength = getStrength(password);
  const checks = [
    { label: '8+ characters', pass: password.length >= 8 },
    { label: 'Uppercase', pass: /[A-Z]/.test(password) },
    { label: 'Number', pass: /[0-9]/.test(password) },
    { label: 'Special char', pass: /[^A-Za-z0-9]/.test(password) },
  ];

  return (
    <div className="space-y-2">
      <div className="flex gap-0.5">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`h-0.5 flex-1 transition-colors duration-300 ${i < strength ? 'bg-vault-text' : 'bg-vault-border'}`} />
        ))}
      </div>
      {password.length > 0 && (
        <p className="text-[10px] text-vault-muted">{labels[strength - 1] || 'Too short'}</p>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {checks.map(c => (
          <span key={c.label} className={`text-[10px] flex items-center gap-1 ${c.pass ? 'text-vault-text' : 'text-vault-muted'}`}>
            {c.pass ? <Check size={8} /> : <X size={8} />} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
