import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { GameStatus, RankRow } from '../../../shared/types';
import { api } from '../lib/api';
import { STATUS_LABEL, formatCode, teamsLabel } from '../host/format';
import ConfirmButton from './ConfirmButton';
import { useAdmin } from './context';

interface GameRow {
  id: string;
  code: string;
  quizTitle: string;
  status: GameStatus;
  createdAt: string;
  finishedAt: string | null;
  teamCount: number;
}

interface Results {
  quizTitle: string;
  finishedAt: string | null;
  ranking: RankRow[];
}

const dateFmt = new Intl.DateTimeFormat('el-GR', { dateStyle: 'medium', timeStyle: 'short' });
const fmtDate = (iso: string) => dateFmt.format(new Date(iso));

export default function Games() {
  const { fail } = useAdmin();
  const [active, setActive] = useState<GameRow[] | null>(null);
  const [past, setPast] = useState<GameRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, Results | 'loading' | 'error'>>({});

  async function load() {
    try {
      const [a, p] = await Promise.all([
        api<GameRow[]>('/games?status=active', { admin: true }),
        api<GameRow[]>('/games?status=past', { admin: true }),
      ]);
      setActive(a);
      setPast(p);
      setError(null);
    } catch (e) {
      setError(fail(e));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function cancel(id: string) {
    try {
      await api(`/games/${id}/cancel`, { method: 'POST', admin: true });
      setActive((list) => list?.filter((g) => g.id !== id) ?? null);
    } catch (e) {
      setError(fail(e));
    }
  }

  async function toggle(id: string) {
    if (open === id) return setOpen(null);
    setOpen(id);
    if (results[id] && results[id] !== 'error') return;
    setResults((r) => ({ ...r, [id]: 'loading' }));
    try {
      const res = await api<Results>(`/games/${id}/results`, { admin: true });
      setResults((r) => ({ ...r, [id]: res }));
    } catch (e) {
      fail(e);
      setResults((r) => ({ ...r, [id]: 'error' }));
    }
  }

  return (
    <section className="admin-section">
      <div className="section-head">
        <h1>Παιχνίδια</h1>
        <button type="button" className="secondary small" onClick={() => void load()}>Ανανέωση</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}

      <h2>Ενεργά</h2>
      {active === null && !error && <p className="muted">Φόρτωση…</p>}
      {active?.length === 0 && <p className="muted">Κανένα ενεργό παιχνίδι.</p>}
      {active && active.length > 0 && (
        <ul className="rows">
          {active.map((g) => (
            <li key={g.id} className="row">
              <span className="code-tag">{formatCode(g.code)}</span>
              <div className="row-main">
                <span className="row-title">{g.quizTitle}</span>
                <span className="muted">
                  {STATUS_LABEL[g.status]} · {teamsLabel(g.teamCount)} · {fmtDate(g.createdAt)}
                </span>
              </div>
              <div className="row-actions">
                <Link className="btn small" to={`/host/${g.id}`}>Συνέχεια</Link>
                <ConfirmButton
                  label="Ακύρωση"
                  question="Ακύρωση του παιχνιδιού;"
                  yes="Ναι, ακύρωση"
                  onConfirm={() => cancel(g.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2>Παλιά</h2>
      {past === null && !error && <p className="muted">Φόρτωση…</p>}
      {past?.length === 0 && <p className="muted">Κανένα ολοκληρωμένο παιχνίδι.</p>}
      {past && past.length > 0 && (
        <ul className="rows">
          {past.map((g) => {
            const r = results[g.id];
            return (
              <li key={g.id} className="row wrap">
                <div className="row-main">
                  <span className="row-title">{g.quizTitle}</span>
                  <span className="muted">
                    {fmtDate(g.finishedAt ?? g.createdAt)} · {teamsLabel(g.teamCount)}
                  </span>
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    className="secondary small"
                    aria-expanded={open === g.id}
                    onClick={() => void toggle(g.id)}
                  >
                    Κατάταξη
                  </button>
                </div>
                {open === g.id && (
                  <div className="row-detail">
                    {r === 'loading' && <p className="muted">Φόρτωση…</p>}
                    {r === 'error' && <p className="form-error">Δεν φορτώθηκε η κατάταξη.</p>}
                    {r && typeof r === 'object' && (
                      r.ranking.length === 0 ? (
                        <p className="muted">Δεν συμμετείχε καμία ομάδα.</p>
                      ) : (
                        <ol className="admin-rank">
                          {r.ranking.map((row) => (
                            <li key={row.teamId}>
                              <span className="n">{row.rank}</span>
                              <span className="nm">{row.name}</span>
                              <span className="sc">{row.score}</span>
                            </li>
                          ))}
                        </ol>
                      )
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
