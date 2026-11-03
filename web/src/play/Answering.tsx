import { useEffect, useState } from 'react';
import { ERROR_TEXT, type ErrorCode } from '../../../shared/errors';
import type { TeamState } from '../../../shared/types';
import { remainingMs } from '../lib/clock';
import type { Emit } from '../lib/socket';
import { LETTERS, secondsLeft } from './format';

interface Props {
  state: TeamState;
  offset: number;
  emit: Emit;
}

export default function Answering({ state, offset, emit }: Props) {
  const current = state.current;
  const [now, setNow] = useState(() => Date.now());
  const [local, setLocal] = useState<{ index: number; choice: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const idx = current?.index;
  const serverChoice = current?.myChoice;
  useEffect(() => {
    setLocal(null);
  }, [idx, serverChoice]);
  useEffect(() => {
    setError(null);
  }, [idx]);

  if (!current) return null;
  const secs = secondsLeft(remainingMs(current.endsAt, offset, now));
  const shown = local && local.index === current.index ? local.choice : current.myChoice;

  async function choose(choice: number) {
    if (!current || choice === shown) return;
    const questionIndex = current.index;
    setLocal({ index: questionIndex, choice });
    setError(null);
    const ack = await emit('team:answer', { questionIndex, choice });
    if (!ack.ok) {
      setLocal(null);
      setError(ERROR_TEXT[ack.error as ErrorCode]);
    }
  }

  return (
    <div className="play">
      <div className="q-head">
        <span>
          Ερώτηση {current.index + 1} από {state.questionCount}
        </span>
        <span className={`q-timer${secs <= 5 ? ' low' : ''}`} aria-label="Υπολειπόμενα δευτερόλεπτα">
          {secs}
        </span>
      </div>
      <p className="q-text">{current.text}</p>
      <div className="opts">
        {current.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            className={`opt${shown === i ? ' chosen' : ''}`}
            aria-pressed={shown === i}
            onClick={() => void choose(i)}
          >
            <span className="letter">{LETTERS[i]}</span>
            <span>{opt}</span>
          </button>
        ))}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="muted">Μπορείτε να την αλλάξετε ως τη λήξη</p>
    </div>
  );
}
