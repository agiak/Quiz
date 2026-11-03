import type { TeamState } from '../../../shared/types';
import { LETTERS, pointsLabel } from './format';

export default function Finished({ state }: { state: TeamState }) {
  const r = state.results;
  if (!r) return <p className="big">Το παιχνίδι ολοκληρώθηκε.</p>;
  const label = (opts: string[], i: number) => `${LETTERS[i]}. ${opts[i]}`;
  return (
    <div className="play">
      <div className="center" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p className="big">Θέση {r.me.rank}</p>
        <p className="big" style={{ color: 'var(--brass)' }}>{pointsLabel(r.me.score)}</p>
      </div>
      <h2>Κατάταξη</h2>
      <ol className="rank">
        {r.ranking.map((row) => (
          <li key={row.teamId} className={row.teamId === r.me.teamId ? 'me' : undefined}>
            <span className="n">{row.rank}</span>
            <span className="nm">{row.name}</span>
            <span className="sc">{row.score}</span>
          </li>
        ))}
      </ol>
      <h2>Οι απαντήσεις σας</h2>
      <div className="review">
        {r.review.map((q) => {
          const right = q.myChoice === q.correctIndex;
          return (
            <div key={q.index} className={`rv ${right ? 'right' : 'wrong'}`}>
              <p><strong>{q.index + 1}. {q.text}</strong></p>
              <p className={right ? 'ok' : 'no'}>
                {q.myChoice === null
                  ? 'Δεν απαντήσατε'
                  : `Η απάντησή σας: ${label(q.options, q.myChoice)}`}
                {right ? ' ✓' : ' ✗'}
              </p>
              {!right && <p className="muted">Σωστή: {label(q.options, q.correctIndex)}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
