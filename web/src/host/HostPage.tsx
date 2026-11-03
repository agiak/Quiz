import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ERROR_TEXT, type ErrorCode } from '../../../shared/errors';
import type { HostState } from '../../../shared/types';
import { ADMIN_TOKEN_KEY, storage } from '../lib/storage';
import { useGameSocket, type Emit } from '../lib/socket';
import { primaryAction, type HostAction } from './format';
import Lobby from './Lobby';
import QuestionView from './QuestionView';
import Reveal from './Reveal';
import './host.css';

export default function HostPage() {
  const { gameId = '' } = useParams();
  const [token] = useState(() => storage.get(ADMIN_TOKEN_KEY));
  if (!token) return <Navigate to={`/admin?next=${encodeURIComponent(`/host/${gameId}`)}`} replace />;
  // The socket reads its auth once at mount: keying on the token remounts it for a new one.
  return <HostScreen key={token} token={token} gameId={gameId} />;
}

const PRIMARY_LABEL: Record<HostAction, string> = {
  start: 'Έναρξη',
  next: 'Επόμενη ερώτηση',
  results: 'Αποτελέσματα',
  'reveal-next': 'Επόμενο',
  close: 'Κλείσιμο τώρα',
};

/** Errors that only mean "the screen was a step behind": the next state fixes the view. */
const QUIET: ErrorCode[] = ['STALE', 'INVALID'];

function HostScreen({ token, gameId }: { token: string; gameId: string }) {
  const navigate = useNavigate();
  const [watchError, setWatchError] = useState<ErrorCode | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const toLogin = useCallback(() => {
    storage.remove(ADMIN_TOKEN_KEY);
    navigate(`/admin?next=${encodeURIComponent(`/host/${gameId}`)}`, { replace: true });
  }, [gameId, navigate]);

  const onConnect = useCallback(
    async (emit: Emit) => {
      try {
        const ack = await emit('host:watch', { gameId });
        if (ack.ok) {
          setWatchError(null);
          return;
        }
        if (ack.error === 'UNAUTHORIZED') toLogin();
        else setWatchError(ack.error);
      } catch {
        /* the next reconnect retries */
      }
    },
    [gameId, toLogin],
  );

  const { state, offset, connected, emit } = useGameSocket<HostState>({ auth: { adminToken: token }, onConnect });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const send = useCallback(
    async (event: string, payload: Record<string, unknown>) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        const ack = await emit(event, { gameId, ...payload });
        if (!ack.ok) {
          const error = ack.error as ErrorCode;
          if (error === 'UNAUTHORIZED') return toLogin();
          if (!QUIET.includes(error)) setToast(ERROR_TEXT[error] ?? ERROR_TEXT.INVALID);
        }
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [emit, gameId, toLogin],
  );

  const act = useCallback(
    (action: HostAction) => {
      if (!state) return;
      void send(`host:${action}`, { expectStep: state.step });
    },
    [send, state],
  );

  const primary = state ? primaryAction(state.status, state.current?.index ?? null, state.questionCount) : null;

  // → / Space trigger the primary action of the current phase.
  useEffect(() => {
    if (!primary || !connected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowRight' && e.key !== ' ') return;
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      // Never while typing or inside an in-page confirm.
      if (t && t.closest('input, textarea, select, [contenteditable], [data-nokeys]')) return;
      // Space activates the focused control natively: on any control but the primary button
      // (e.g. a team's ×) it must keep that meaning and never start the game.
      // → has no native meaning on a button, so it always works.
      if (e.key === ' ' && t && t.closest('button, a, summary, [role=button]') && !t.closest('[data-primary]')) return;
      e.preventDefault();
      act(primary);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [primary, connected, act]);

  if (watchError) {
    return (
      <main className="host">
        <div className="host-center">
          <p className="host-message">
            {watchError === 'GAME_NOT_FOUND' || watchError === 'INVALID'
              ? 'Δεν βρέθηκε αυτό το παιχνίδι.'
              : ERROR_TEXT[watchError]}
          </p>
          <Link className="host-link" to="/admin/games">Πίσω στη διαχείριση</Link>
        </div>
      </main>
    );
  }

  const disabled = busy || !connected;

  return (
    <main className={`host status-${state?.status ?? 'loading'}`}>
      <div className="host-stage">
        {!state ? (
          <div className="host-center"><p className="host-message muted">Φόρτωση…</p></div>
        ) : (
          <Phase state={state} offset={offset} disabled={disabled} onRemove={(teamId) => send('host:remove-team', { teamId })} />
        )}
      </div>

      <footer
        className="host-bar"
        onClick={(e) => {
          // After a mouse click (detail > 0) drop focus, so Space works as the shortcut again.
          // Keyboard activation (detail 0) keeps focus where the user put it.
          if (e.detail > 0 && document.activeElement instanceof HTMLElement) document.activeElement.blur();
        }}
      >
        <span className="host-bar-info">
          {state && (
            <>
              <strong>{state.quizTitle}</strong>
              {state.status !== 'lobby' && <span className="muted"> · κωδικός {state.code}</span>}
            </>
          )}
        </span>
        {toast && <span className="host-toast" role="alert">{toast}</span>}
        <span className="host-bar-actions">
          <FullscreenButton />
          {state?.status === 'question_open' && (
            <button type="button" className="secondary" disabled={disabled} onClick={() => act('close')}>
              Κλείσιμο τώρα
            </button>
          )}
          {state?.status === 'lobby' && state.teams.length === 0 && (
            <span className="host-hint">Καμία ομάδα ακόμη: μπορείτε να ξεκινήσετε και έτσι</span>
          )}
          {primary && (
            <button type="button" className="primary" data-primary disabled={disabled} onClick={() => act(primary)}>
              {PRIMARY_LABEL[primary]} <kbd aria-hidden="true">→</kbd>
            </button>
          )}
          {(state?.status === 'finished' || state?.status === 'cancelled') && (
            <Link className="btn" to="/admin/games">Πίσω στη διαχείριση</Link>
          )}
        </span>
      </footer>

      {!connected && (
        <div className="host-overlay" role="status">
          <p className="conn-big">Σύνδεση με τον server…</p>
        </div>
      )}
    </main>
  );
}

function Phase({
  state,
  offset,
  disabled,
  onRemove,
}: {
  state: HostState;
  offset: number;
  disabled: boolean;
  onRemove: (teamId: string) => Promise<void>;
}) {
  switch (state.status) {
    case 'lobby':
      return <Lobby state={state} disabled={disabled} onRemove={onRemove} />;
    case 'question_open':
    case 'question_closed':
      return <QuestionView state={state} offset={offset} />;
    case 'revealing':
    case 'finished':
      return <Reveal state={state} />;
    case 'cancelled':
      return (
        <div className="host-center">
          <p className="host-message">Το παιχνίδι ακυρώθηκε.</p>
        </div>
      );
  }
}

function FullscreenButton() {
  const [full, setFull] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  if (typeof document === 'undefined' || !document.documentElement.requestFullscreen) return null;
  async function toggle() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* not allowed here (e.g. inside an iframe) */
    }
  }
  return (
    <button type="button" className="secondary ghost" onClick={() => void toggle()}>
      {full ? 'Έξοδος από πλήρη οθόνη' : 'Πλήρης οθόνη'}
    </button>
  );
}
