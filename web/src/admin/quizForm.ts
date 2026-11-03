import { OPTIONS_MAX, OPTIONS_MIN, TIME_DEFAULT_SEC, TIME_MAX_SEC, TIME_MIN_SEC } from '../../../shared/constants';
import { quizInputSchema, type QuizInput } from '../../../shared/schemas';
import type { Quiz } from '../../../shared/types';

/** Editor state: times are kept as typed text, the correct answer may be unset. */
export interface DraftQuestion {
  key: number;
  text: string;
  options: string[];
  correctIndex: number | null;
  /** '' = use the quiz time */
  time: string;
}

export interface Draft {
  title: string;
  time: string;
  questions: DraftQuestion[];
}

let nextKey = 1;
const newKey = () => nextKey++;

export function blankQuestion(): DraftQuestion {
  return { key: newKey(), text: '', options: ['', '', '', ''], correctIndex: null, time: '' };
}

export function blankDraft(): Draft {
  return { title: '', time: String(TIME_DEFAULT_SEC), questions: [blankQuestion()] };
}

export function draftFromQuiz(q: Quiz): Draft {
  return {
    title: q.title,
    time: String(q.timeLimitSec),
    questions: q.questions.map((x) => ({
      key: newKey(),
      text: x.text,
      options: [...x.options],
      correctIndex: x.correctIndex,
      time: x.timeLimitSec === null ? '' : String(x.timeLimitSec),
    })),
  };
}

function parseSec(s: string): number {
  const t = s.trim();
  return /^\d+$/.test(t) ? Number(t) : Number.NaN;
}

/** The raw (unvalidated) payload for the API. */
export function draftToInput(d: Draft) {
  return {
    title: d.title,
    timeLimitSec: parseSec(d.time),
    questions: d.questions.map((q) => ({
      text: q.text,
      options: q.options,
      correctIndex: q.correctIndex ?? -1,
      timeLimitSec: q.time.trim() === '' ? null : parseSec(q.time),
    })),
  };
}

/** Comparable form of a draft (ignores the React keys). */
export function draftSignature(d: Draft): string {
  return JSON.stringify(draftToInput(d));
}

const TIME_MSG = `Από ${TIME_MIN_SEC} έως ${TIME_MAX_SEC} δευτερόλεπτα.`;

/** Greek message for a schema issue path (e.g. ['questions', 0, 'options', 2]). */
export function messageFor(path: (string | number)[]): string {
  const [head, qi, field, oi] = path;
  if (head === 'title') return 'Γράψτε τίτλο (έως 120 χαρακτήρες).';
  if (head === 'timeLimitSec') return TIME_MSG;
  if (head === 'questions') {
    if (qi === undefined) return 'Προσθέστε τουλάχιστον μία ερώτηση.';
    if (field === 'text') return 'Γράψτε το κείμενο της ερώτησης.';
    if (field === 'options') {
      return oi === undefined
        ? `Από ${OPTIONS_MIN} έως ${OPTIONS_MAX} επιλογές.`
        : 'Γράψτε την επιλογή ή αφαιρέστε την.';
    }
    if (field === 'correctIndex') return 'Επιλέξτε τη σωστή απάντηση.';
    if (field === 'timeLimitSec') return `${TIME_MSG} Αφήστε το κενό για τον χρόνο του κουίζ.`;
  }
  return 'Μη έγκυρη τιμή.';
}

export type FieldErrors = Record<string, string>;

/** Validates with the shared schema; error keys are the joined issue paths ('questions.0.text'). */
export function validateDraft(d: Draft): { input: QuizInput; errors: null } | { input: null; errors: FieldErrors } {
  const r = quizInputSchema.safeParse(draftToInput(d));
  if (r.success) return { input: r.data, errors: null };
  const errors: FieldErrors = {};
  for (const issue of r.error.issues) {
    const key = issue.path.join('.');
    if (!(key in errors)) errors[key] = messageFor(issue.path);
  }
  return { input: null, errors };
}

/** Removes option `i`, keeping the correct answer pointing at the same option. */
export function removeOption(q: DraftQuestion, i: number): DraftQuestion {
  const options = q.options.filter((_, j) => j !== i);
  let correctIndex = q.correctIndex;
  if (correctIndex === i) correctIndex = null;
  else if (correctIndex !== null && correctIndex > i) correctIndex -= 1;
  return { ...q, options, correctIndex };
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
