import type { HostState, RankRow } from '../../../shared/types';
import { pointsLabel } from '../play/format';
import { AnswerTiles, QuestionText } from './QuestionView';

export default function Reveal({ state }: { state: HostState }) {
  const r = state.reveal;
  if (!r) return null;
  const finished = state.status === 'finished';

  // Answers phase: until the first ranking row is shown, the newest revealed question is on screen.
  if (!finished && r.ranking.length === 0) {
    const q = r.answers[r.answers.length - 1];
    if (!q) return null;
    return (
      <div className="qview reveal-answer">
        <div className="qview-head">
          <span className="qnum">
            Σωστή απάντηση · Ερώτηση <strong>{q.index + 1}</strong> από {state.questionCount}
          </span>
        </div>
        <QuestionText key={`q${q.index}`} text={q.text} />
        <AnswerTiles key={`a${q.index}`} options={q.options} correctIndex={q.correctIndex} />
      </div>
    );
  }

  return <Ranking rows={r.ranking} finished={finished} title={state.quizTitle} />;
}

function Ranking({ rows, finished, title }: { rows: RankRow[]; finished: boolean; title: string }) {
  if (finished && rows.length === 0) {
    return (
      <div className="host-center">
        <p className="eyebrow">{title}</p>
        <p className="host-message">Τέλος! Δεν συμμετείχε καμία ομάδα.</p>
      </div>
    );
  }
  const winners = rows.filter((x) => x.rank === 1);
  const rest = rows.filter((x) => x.rank !== 1);
  // ranking only ever grows at the top: its first row is the one just revealed.
  const newest = finished ? null : rows[0]?.teamId;

  return (
    <div className={`ranking${finished ? ' finished' : ''}`}>
      <p className="eyebrow">{finished ? title : 'Κατάταξη'}</p>
      <div className={`podium${winners.length ? ' revealed' : ''}`} aria-live="polite">
        {finished && <Confetti />}
        <span className="podium-label">1η θέση</span>
        {winners.length === 0 ? (
          <span className="podium-name pending">?</span>
        ) : (
          winners.map((w) => (
            <div key={w.teamId} className="winner">
              <span className="podium-name">{w.name}</span>
              <span className="podium-score">{pointsLabel(w.score)}</span>
            </div>
          ))
        )}
      </div>
      <ol className={`board${rest.length > 8 ? ' many' : ''}`} aria-live="polite">
        {rest.map((row) => (
          <li key={row.teamId} className={row.teamId === newest ? 'new' : undefined}>
            <span className="n">{row.rank}</span>
            <span className="nm">{row.name}</span>
            <span className="sc">{row.score}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** A few brass flakes falling behind the winner (hidden with prefers-reduced-motion). */
function Confetti() {
  return (
    <span className="confetti" aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            animationDelay: `${((i * 53) % 40) / 10}s`,
            animationDuration: `${3 + ((i * 29) % 30) / 10}s`,
          }}
        />
      ))}
    </span>
  );
}
