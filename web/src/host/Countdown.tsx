import { useEffect, useRef, useState } from 'react';
import { remainingMs } from '../lib/clock';
import { secondsLeft } from '../play/format';
import { ringFraction } from './format';

interface Props {
  endsAt: number;
  offset: number;
  /** Frozen at zero (question closed). */
  stopped?: boolean;
}

const R = 54;
const C = 2 * Math.PI * R;

/**
 * Big circular countdown. The state carries no total duration, so the ring's full length is the
 * time left when this question was first seen (rounded up to a whole second).
 */
export default function Countdown({ endsAt, offset, stopped = false }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const totalRef = useRef<{ endsAt: number; total: number } | null>(null);

  useEffect(() => {
    if (stopped) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [stopped]);

  const left = stopped ? 0 : remainingMs(endsAt, offset, now);
  if (!totalRef.current || totalRef.current.endsAt !== endsAt) {
    totalRef.current = { endsAt, total: Math.max(1000, Math.ceil(left / 1000) * 1000) };
  }
  const frac = ringFraction(left, totalRef.current.total);
  const secs = secondsLeft(left);
  const low = !stopped && secs <= 5;

  return (
    <div className={`countdown${low ? ' low' : ''}${stopped ? ' stopped' : ''}`} role="timer" aria-label={`${secs} δευτερόλεπτα`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="track" cx="60" cy="60" r={R} />
        <circle
          className="arc"
          cx="60"
          cy="60"
          r={R}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <span className="secs">{secs}</span>
    </div>
  );
}
