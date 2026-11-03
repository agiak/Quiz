import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ERROR_TEXT, type ErrorCode } from '../../../shared/errors';
import type { TeamState } from '../../../shared/types';
import { TEAM_TOKEN_KEY, storage } from '../lib/storage';
import { useGameSocket, type Emit } from '../lib/socket';
import Answering from './Answering';
import Finished from './Finished';
import JoinForm from './JoinForm';
import './play.css';

const REMOVED_TEXT = 'Η ομάδα σας αφαιρέθηκε από τον παρουσιαστή.';

export default function PlayPage() {
  const [params] = useSearchParams();
  const [hasToken, setHasToken] = useState(() => storage.get(TEAM_TOKEN_KEY) !== null);
  const [notice, setNotice] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  const onConnect = useCallback(async (emit: Emit) => {
    const token = storage.get(TEAM_TOKEN_KEY);
    if (!token) return;
    try {
      const ack = await emit('team:resume', { token });
      if (!ack.ok) {
        if (ack.error === 'BAD_TOKEN' || ack.error === 'TEAM_REMOVED') {
          storage.remove(TEAM_TOKEN_KEY);
          setHasToken(false);
        }
        setNotice(ERROR_TEXT[ack.error as ErrorCode]);
      }
    } catch {
      /* the next reconnect retries */
    }
  }, []);

  const { state, offset, connected, emit, onEvent } = useGameSocket<TeamState>({ onConnect });

  useEffect(
    () =>
      onEvent('team:removed', () => {
        storage.remove(TEAM_TOKEN_KEY);
        setHasToken(false);
        setNotice(null);
        setRemoved(true);
      }),
    [onEvent],
  );

  async function join(code: string, name: string) {
    setNotice(null);
    const ack = await emit('team:join', { code, name });
    if (ack.ok) {
      storage.set(TEAM_TOKEN_KEY, ack.token as string);
      setRemoved(false);
      setHasToken(true);
    } else {
      setNotice(ERROR_TEXT[ack.error as ErrorCode]);
    }
  }

  function backToForm() {
    storage.remove(TEAM_TOKEN_KEY);
    setHasToken(false);
    setRemoved(false);
    setNotice(null);
  }

  const connecting = !connected ? (
    <p className="conn" role="status">Σύνδεση με τον server…</p>
  ) : null;

  if (removed) {
    return (
      <main className="play center">
        <p className="big">{REMOVED_TEXT}</p>
        <button type="button" onClick={backToForm}>Νέα συμμετοχή</button>
      </main>
    );
  }

  if (!hasToken) {
    return (
      <main className="play">
        {connecting}
        <JoinForm
          initialCode={params.get('code') ?? ''}
          error={notice}
          disabled={!connected}
          onSubmit={join}
        />
      </main>
    );
  }

  if (!state) {
    return (
      <main className="play center">
        {connecting ?? <p className="conn" role="status">Σύνδεση με τον server…</p>}
        {notice && <p className="error" role="alert">{notice}</p>}
      </main>
    );
  }

  return (
    <main className="play">
      {connecting}
      <Screen state={state} offset={offset} emit={emit} onLeave={backToForm} />
    </main>
  );
}

function Screen({
  state,
  offset,
  emit,
  onLeave,
}: {
  state: TeamState;
  offset: number;
  emit: Emit;
  onLeave: () => void;
}) {
  switch (state.status) {
    case 'lobby':
      return (
        <div className="play center">
          <p className="big">Η ομάδα σας μπήκε. Περιμένετε να ξεκινήσει το παιχνίδι</p>
          <p className="muted">{state.teamName}</p>
        </div>
      );
    case 'question_open':
      return <Answering state={state} offset={offset} emit={emit} />;
    case 'question_closed':
      return (
        <div className="play center">
          <p className="big">
            {state.current && state.current.myChoice !== null
              ? 'Η απάντησή σας καταχωρήθηκε'
              : 'Δεν απαντήσατε'}
          </p>
        </div>
      );
    case 'revealing':
      return (
        <div className="play center">
          <p className="big">Κοιτάξτε την κεντρική οθόνη</p>
        </div>
      );
    case 'finished':
      return <Finished state={state} />;
    case 'cancelled':
      return (
        <div className="play center">
          <p className="big">Το παιχνίδι ακυρώθηκε.</p>
          <button type="button" onClick={onLeave}>Νέα συμμετοχή</button>
        </div>
      );
  }
}
