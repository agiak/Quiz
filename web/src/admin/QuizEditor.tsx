import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { OPTIONS_MAX, OPTIONS_MIN, TIME_MAX_SEC, TIME_MIN_SEC } from '../../../shared/constants';
import type { Quiz } from '../../../shared/types';
import { api } from '../lib/api';
import { LETTERS } from '../play/format';
import ConfirmButton from './ConfirmButton';
import { useAdmin } from './context';
import { useNewGame } from './QuizList';
import {
  blankDraft,
  blankQuestion,
  draftFromQuiz,
  draftSignature,
  moveItem,
  removeOption,
  validateDraft,
  type Draft,
  type DraftQuestion,
  type FieldErrors,
} from './quizForm';

function FieldError({ errors, k }: { errors: FieldErrors; k: string }) {
  const msg = errors[k];
  return msg ? <span className="field-error" id={`err-${k}`}>{msg}</span> : null;
}

const invalid = (errors: FieldErrors, k: string) =>
  errors[k] ? { 'aria-invalid': true as const, 'aria-describedby': `err-${k}` } : {};

export default function QuizEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fail } = useAdmin();
  const game = useNewGame();

  const [draft, setDraft] = useState<Draft | null>(id ? null : blankDraft);
  const [savedSig, setSavedSig] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) {
      setDraft(blankDraft());
      setSavedSig(null);
      return;
    }
    let alive = true;
    setDraft(null);
    api<Quiz>(`/quizzes/${id}`, { admin: true })
      .then((q) => {
        if (!alive) return;
        const d = draftFromQuiz(q);
        setDraft(d);
        setSavedSig(draftSignature(d));
        setSavedCount(q.questions.length);
      })
      .catch((e) => alive && setStatus({ kind: 'error', text: fail(e) }));
    return () => {
      alive = false;
    };
  }, [id, fail]);

  const dirty = useMemo(() => (draft ? draftSignature(draft) !== savedSig : false), [draft, savedSig]);

  if (!draft) {
    return (
      <section className="admin-section">
        <Link to="/admin" className="back">← Κουίζ</Link>
        {status ? <p className="form-error" role="alert">{status.text}</p> : <p className="muted">Φόρτωση…</p>}
      </section>
    );
  }

  const d = draft;
  const update = (patch: Partial<Draft>) => {
    const next = { ...d, ...patch };
    setDraft(next);
    setStatus(null);
    // After a failed save, keep the messages in step with the edits.
    if (Object.keys(errors).length > 0) setErrors(validateDraft(next).errors ?? {});
  };
  const updateQ = (i: number, q: DraftQuestion) =>
    update({ questions: d.questions.map((x, j) => (j === i ? q : x)) });

  async function save(e: FormEvent) {
    e.preventDefault();
    const r = validateDraft(d);
    if (r.errors) {
      setErrors(r.errors);
      setStatus({ kind: 'error', text: 'Διορθώστε τα πεδία με κόκκινο και ξαναδοκιμάστε.' });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const sig = draftSignature(d);
      const quiz = id
        ? await api<Quiz>(`/quizzes/${id}`, { method: 'PUT', body: r.input, admin: true })
        : await api<Quiz>('/quizzes', { method: 'POST', body: r.input, admin: true });
      setSavedSig(sig);
      setSavedCount(quiz.questions.length);
      setStatus({ kind: 'ok', text: 'Αποθηκεύτηκε.' });
      if (!id) navigate(`/admin/quizzes/${quiz.id}`, { replace: true });
    } catch (err) {
      setStatus({ kind: 'error', text: fail(err) });
    } finally {
      setSaving(false);
    }
  }

  const canStart = !!id && !dirty && savedCount > 0;

  return (
    <section className="admin-section">
      <Link to="/admin" className="back">← Κουίζ</Link>
      <form className="editor" onSubmit={(e) => void save(e)} noValidate>
        <div className="section-head">
          <h1>{id ? 'Επεξεργασία κουίζ' : 'Νέο κουίζ'}</h1>
        </div>

        <div className="card quiz-meta">
          <label className="field grow">
            <span>Τίτλος</span>
            <input
              value={d.title}
              maxLength={120}
              onChange={(e) => update({ title: e.target.value })}
              {...invalid(errors, 'title')}
            />
            <FieldError errors={errors} k="title" />
          </label>
          <label className="field time">
            <span>Χρόνος ανά ερώτηση (δευτ.)</span>
            <input
              type="number"
              inputMode="numeric"
              min={TIME_MIN_SEC}
              max={TIME_MAX_SEC}
              value={d.time}
              onChange={(e) => update({ time: e.target.value })}
              {...invalid(errors, 'timeLimitSec')}
            />
            <FieldError errors={errors} k="timeLimitSec" />
          </label>
        </div>

        <h2>Ερωτήσεις ({d.questions.length})</h2>
        <FieldError errors={errors} k="questions" />
        <ol className="questions">
          {d.questions.map((q, i) => (
            <QuestionCard
              key={q.key}
              q={q}
              i={i}
              count={d.questions.length}
              quizTime={d.time}
              errors={errors}
              onChange={(nq) => updateQ(i, nq)}
              onMove={(to) => update({ questions: moveItem(d.questions, i, to) })}
              onDelete={() => update({ questions: d.questions.filter((_, j) => j !== i) })}
            />
          ))}
        </ol>
        <div>
          <button
            type="button"
            className="secondary"
            onClick={() => update({ questions: [...d.questions, blankQuestion()] })}
          >
            + Προσθήκη ερώτησης
          </button>
        </div>

        <div className="save-bar">
          {status && (
            <p className={status.kind === 'ok' ? 'form-ok' : 'form-error'} role={status.kind === 'ok' ? 'status' : 'alert'}>
              {status.text}
            </p>
          )}
          {dirty && !status && <p className="muted">Μη αποθηκευμένες αλλαγές</p>}
          <span className="spacer" />
          {id && (
            <button
              type="button"
              className="secondary"
              disabled={!canStart || game.busy}
              title={dirty ? 'Αποθηκεύστε πρώτα τις αλλαγές' : undefined}
              onClick={() => id && void game.start(id)}
            >
              Νέο παιχνίδι
            </button>
          )}
          <button type="submit" disabled={saving || (!!id && !dirty)}>
            {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
          </button>
        </div>
        {game.error && <p className="form-error" role="alert">{game.error}</p>}
      </form>
    </section>
  );
}

interface CardProps {
  q: DraftQuestion;
  i: number;
  count: number;
  quizTime: string;
  errors: FieldErrors;
  onChange: (q: DraftQuestion) => void;
  onMove: (to: number) => void;
  onDelete: () => void;
}

function QuestionCard({ q, i, count, quizTime, errors, onChange, onMove, onDelete }: CardProps) {
  const p = `questions.${i}`;
  return (
    <li className="card question-card">
      <div className="qc-head">
        <span className="qc-num">Ερώτηση {i + 1}</span>
        <span className="spacer" />
        <button type="button" className="secondary small icon" aria-label="Μετακίνηση πάνω" disabled={i === 0} onClick={() => onMove(i - 1)}>
          ↑
        </button>
        <button type="button" className="secondary small icon" aria-label="Μετακίνηση κάτω" disabled={i === count - 1} onClick={() => onMove(i + 1)}>
          ↓
        </button>
        <ConfirmButton label="Διαγραφή" question="Διαγραφή της ερώτησης;" yes="Ναι, διαγραφή" onConfirm={onDelete} />
      </div>

      <label className="field">
        <span>Κείμενο ερώτησης</span>
        <textarea
          rows={2}
          value={q.text}
          onChange={(e) => onChange({ ...q, text: e.target.value })}
          {...invalid(errors, `${p}.text`)}
        />
        <FieldError errors={errors} k={`${p}.text`} />
      </label>

      <fieldset className="options">
        <legend>Επιλογές (σημειώστε τη σωστή)</legend>
        {q.options.map((opt, j) => (
          <div key={j} className={`option${q.correctIndex === j ? ' correct' : ''}`}>
            <label className="radio" title="Σωστή απάντηση">
              <input
                type="radio"
                name={`correct-${q.key}`}
                checked={q.correctIndex === j}
                onChange={() => onChange({ ...q, correctIndex: j })}
                aria-label={`Η ${LETTERS[j]} είναι η σωστή`}
              />
              <span className="letter">{LETTERS[j]}</span>
            </label>
            <div className="option-input">
              <input
                value={opt}
                aria-label={`Επιλογή ${LETTERS[j]}`}
                onChange={(e) => onChange({ ...q, options: q.options.map((o, k) => (k === j ? e.target.value : o)) })}
                {...invalid(errors, `${p}.options.${j}`)}
              />
              <FieldError errors={errors} k={`${p}.options.${j}`} />
            </div>
            <button
              type="button"
              className="secondary small icon"
              aria-label={`Αφαίρεση επιλογής ${LETTERS[j]}`}
              disabled={q.options.length <= OPTIONS_MIN}
              onClick={() => onChange(removeOption(q, j))}
            >
              ×
            </button>
          </div>
        ))}
        <FieldError errors={errors} k={`${p}.options`} />
        <FieldError errors={errors} k={`${p}.correctIndex`} />
        {q.options.length < OPTIONS_MAX && (
          <div>
            <button type="button" className="secondary small" onClick={() => onChange({ ...q, options: [...q.options, ''] })}>
              + Επιλογή
            </button>
          </div>
        )}
      </fieldset>

      <label className="field time">
        <span>Δικός της χρόνος (δευτ., προαιρετικά)</span>
        <input
          type="number"
          inputMode="numeric"
          min={TIME_MIN_SEC}
          max={TIME_MAX_SEC}
          placeholder={quizTime ? `${quizTime} (του κουίζ)` : 'του κουίζ'}
          value={q.time}
          onChange={(e) => onChange({ ...q, time: e.target.value })}
          {...invalid(errors, `${p}.timeLimitSec`)}
        />
        <FieldError errors={errors} k={`${p}.timeLimitSec`} />
      </label>
    </li>
  );
}
