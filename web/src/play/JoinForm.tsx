import { useState, type FormEvent } from 'react';

interface Props {
  initialCode: string;
  notice?: string | null;
  error?: string | null;
  disabled?: boolean;
  onSubmit: (code: string, name: string) => Promise<void>;
}

export default function JoinForm({ initialCode, notice, error, disabled, onSubmit }: Props) {
  const [code, setCode] = useState(initialCode.replace(/\D/g, '').slice(0, 6));
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = /^\d{6}$/.test(code) && name.trim().length > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    try {
      await onSubmit(code, name.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <h1>Μπείτε στο κουίζ</h1>
      {notice && <p className="notice" role="status">{notice}</p>}
      <label>
        Κωδικός παιχνιδιού
        <input
          className="code-input"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={6}
          placeholder="••••••"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
      </label>
      <label>
        Όνομα ομάδας
        <input
          maxLength={30}
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" disabled={!valid || busy || disabled}>
        {busy ? 'Παρακαλώ περιμένετε…' : 'Μπείτε'}
      </button>
    </form>
  );
}
