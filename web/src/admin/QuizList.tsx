import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Quiz } from '../../../shared/types';
import { api } from '../lib/api';
import ConfirmButton from './ConfirmButton';
import { useAdmin } from './context';

export function questionsLabel(n: number): string {
  return n === 1 ? '1 ερώτηση' : `${n} ερωτήσεις`;
}

/** Creates a game for a quiz and opens the presenter screen. */
export function useNewGame() {
  const { fail } = useAdmin();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function start(quizId: string) {
    setBusy(true);
    setError(null);
    try {
      const g = await api<{ id: string; code: string }>(`/quizzes/${quizId}/games`, { method: 'POST', admin: true });
      navigate(`/host/${g.id}`);
    } catch (e) {
      setError(fail(e));
      setBusy(false);
    }
  }
  return { start, busy, error };
}

export default function QuizList() {
  const { fail } = useAdmin();
  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const game = useNewGame();

  async function load() {
    try {
      setQuizzes(await api<Quiz[]>('/quizzes', { admin: true }));
      setError(null);
    } catch (e) {
      setError(fail(e));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function remove(id: string) {
    try {
      await api(`/quizzes/${id}`, { method: 'DELETE', admin: true });
      setQuizzes((qs) => qs?.filter((q) => q.id !== id) ?? null);
    } catch (e) {
      setError(fail(e));
    }
  }

  return (
    <section className="admin-section">
      <div className="section-head">
        <h1>Κουίζ</h1>
        <Link className="btn" to="/admin/quizzes/new">Νέο κουίζ</Link>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {game.error && <p className="form-error" role="alert">{game.error}</p>}
      {quizzes === null && !error && <p className="muted">Φόρτωση…</p>}
      {quizzes?.length === 0 && <p className="muted">Δεν υπάρχουν κουίζ ακόμη. Φτιάξτε το πρώτο.</p>}
      {quizzes && quizzes.length > 0 && (
        <ul className="rows">
          {quizzes.map((q) => (
            <li key={q.id} className="row">
              <div className="row-main">
                <Link to={`/admin/quizzes/${q.id}`} className="row-title">{q.title}</Link>
                <span className="muted">
                  {questionsLabel(q.questions.length)} · {q.timeLimitSec}″ ανά ερώτηση
                </span>
              </div>
              <div className="row-actions">
                <Link className="btn secondary small" to={`/admin/quizzes/${q.id}`}>Επεξεργασία</Link>
                <button
                  type="button"
                  className="small"
                  disabled={game.busy || q.questions.length === 0}
                  title={q.questions.length === 0 ? 'Χρειάζεται τουλάχιστον μία ερώτηση' : undefined}
                  onClick={() => void game.start(q.id)}
                >
                  Νέο παιχνίδι
                </button>
                <ConfirmButton
                  label="Διαγραφή"
                  question={`Διαγραφή του «${q.title}»;`}
                  yes="Ναι, διαγραφή"
                  onConfirm={() => remove(q.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
