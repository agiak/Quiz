import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { ApiError, SERVER_URL } from '../lib/api';
import { ADMIN_TOKEN_KEY, storage } from '../lib/storage';
import { AdminContext, errorText, type AdminCtx } from './context';
import Games from './Games';
import Login from './Login';
import QuizEditor from './QuizEditor';
import QuizList from './QuizList';
import './admin.css';

const WAKE_RETRY_MS = 3_000;
const WAKE_LIMIT_MS = 90_000;
const ATTEMPT_TIMEOUT_MS = 20_000;

type Wake = 'waking' | 'up' | 'down';

/** Pings /health until the (possibly sleeping) Render server answers. */
function useWakeServer(): [Wake, () => void] {
  const [wake, setWake] = useState<Wake>('waking');
  const [round, setRound] = useState(0);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = Date.now() + WAKE_LIMIT_MS;
    setWake('waking');

    async function ping() {
      const ctrl = new AbortController();
      const abort = setTimeout(() => ctrl.abort(), ATTEMPT_TIMEOUT_MS);
      try {
        const res = await fetch(`${SERVER_URL}/health`, { signal: ctrl.signal, cache: 'no-store' });
        if (res.ok) {
          if (alive) setWake('up');
          return;
        }
      } catch {
        /* still asleep or offline */
      } finally {
        clearTimeout(abort);
      }
      if (!alive) return;
      if (Date.now() >= deadline) setWake('down');
      else timer = setTimeout(() => void ping(), WAKE_RETRY_MS);
    }
    void ping();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [round]);

  return [wake, () => setRound((r) => r + 1)];
}

export default function AdminApp() {
  const [token, setToken] = useState(() => storage.get(ADMIN_TOKEN_KEY));
  const [expired, setExpired] = useState(false);
  const [wake, retryWake] = useWakeServer();

  const logout = useCallback(() => {
    storage.remove(ADMIN_TOKEN_KEY);
    setToken(null);
  }, []);

  const ctx = useMemo<AdminCtx>(
    () => ({
      logout,
      fail: (e) => {
        if (e instanceof ApiError && e.status === 401) {
          setExpired(true);
          logout();
        }
        return errorText(e);
      },
    }),
    [logout],
  );

  if (wake !== 'up') {
    return (
      <main className="page admin">
        <h1>Διαχείριση</h1>
        {wake === 'waking' ? (
          <p className="conn" role="status">Ο server ξυπνάει…</p>
        ) : (
          <>
            <p className="form-error" role="alert">Ο server δεν απαντά. Δοκιμάστε ξανά σε λίγο.</p>
            <div>
              <button type="button" onClick={retryWake}>Δοκιμή ξανά</button>
            </div>
          </>
        )}
      </main>
    );
  }

  if (!token) {
    return (
      <Login
        notice={expired ? 'Η σύνδεση έληξε. Συνδεθείτε ξανά.' : null}
        onLogin={(t) => {
          storage.set(ADMIN_TOKEN_KEY, t);
          setExpired(false);
          setToken(t);
        }}
      />
    );
  }

  return (
    <AdminContext.Provider value={ctx}>
      <main className="page wide admin">
        <header className="admin-bar">
          <span className="brand">Διαχείριση</span>
          <nav>
            <NavLink to="/admin" end>Κουίζ</NavLink>
            <NavLink to="/admin/games">Παιχνίδια</NavLink>
          </nav>
          <button type="button" className="secondary small" onClick={logout}>Αποσύνδεση</button>
        </header>
        <Routes>
          <Route index element={<QuizList />} />
          <Route path="quizzes/new" element={<QuizEditor />} />
          <Route path="quizzes/:id" element={<QuizEditor />} />
          <Route path="games" element={<Games />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </AdminContext.Provider>
  );
}
