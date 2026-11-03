import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { errorText } from './context';

interface Props {
  notice: string | null;
  onLogin: (token: string) => void;
}

export default function Login({ notice, onLogin }: Props) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [params] = useSearchParams();
  const navigate = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { token } = await api<{ token: string }>('/admin/login', { body: { password } });
      // Came here from the presenter screen: go back to it.
      const next = params.get('next');
      if (next && /^\/host\/[\w-]+$/.test(next)) navigate(next, { replace: true });
      onLogin(token);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <main className="page admin">
      <form className="card login" onSubmit={(e) => void submit(e)}>
        <h1>Σύνδεση διαχειριστή</h1>
        {notice && !error && <p className="form-notice" role="status">{notice}</p>}
        <label className="field">
          <span>Κωδικός πρόσβασης</span>
          <input
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error ? true : undefined}
          />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy || !password}>
          {busy ? 'Σύνδεση…' : 'Σύνδεση'}
        </button>
      </form>
    </main>
  );
}
