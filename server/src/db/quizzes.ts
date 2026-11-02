import type { z } from 'zod';
import type { quizInputSchema } from '../../../shared/schemas';
import type { Question, Quiz } from '../../../shared/types';
import { withTx, type Queryable } from './pool';

export type QuizInput = z.infer<typeof quizInputSchema>;

interface QuizRow { id: string; title: string; time_limit_sec: number; updated_at: Date }
interface QuestionRow {
  quiz_id: string; text: string; options: string[]; correct_index: number; time_limit_sec: number | null;
}

const toQuestion = (r: QuestionRow): Question => ({
  text: r.text,
  options: r.options,
  correctIndex: r.correct_index,
  timeLimitSec: r.time_limit_sec,
});

async function hydrate(db: Queryable, rows: QuizRow[]): Promise<Quiz[]> {
  if (rows.length === 0) return [];
  const qs = await db.query<QuestionRow>(
    'SELECT quiz_id, text, options, correct_index, time_limit_sec FROM questions WHERE quiz_id = ANY($1::uuid[]) ORDER BY quiz_id, position',
    [rows.map((r) => r.id)],
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    timeLimitSec: r.time_limit_sec,
    updatedAt: r.updated_at.toISOString(),
    questions: qs.rows.filter((q) => q.quiz_id === r.id).map(toQuestion),
  }));
}

const INSERT_QUESTIONS = `
  INSERT INTO questions (quiz_id, position, text, options, correct_index, time_limit_sec)
  SELECT $1, ord - 1, q->>'text', ARRAY(SELECT jsonb_array_elements_text(q->'options')),
         (q->>'correctIndex')::int, (q->>'timeLimitSec')::int
  FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY AS t(q, ord)`;

export async function listQuizzes(db: Queryable): Promise<Quiz[]> {
  const r = await db.query<QuizRow>(
    'SELECT id, title, time_limit_sec, updated_at FROM quizzes ORDER BY updated_at DESC',
  );
  return hydrate(db, r.rows);
}

export async function getQuiz(db: Queryable, id: string): Promise<Quiz | null> {
  const r = await db.query<QuizRow>(
    'SELECT id, title, time_limit_sec, updated_at FROM quizzes WHERE id = $1',
    [id],
  );
  return (await hydrate(db, r.rows))[0] ?? null;
}

export async function createQuiz(db: Queryable, input: QuizInput): Promise<Quiz> {
  const id = await withTx(db, async (q) => {
    const r = await q.query<{ id: string }>(
      'INSERT INTO quizzes (title, time_limit_sec) VALUES ($1, $2) RETURNING id',
      [input.title, input.timeLimitSec],
    );
    await q.query(INSERT_QUESTIONS, [r.rows[0].id, JSON.stringify(input.questions)]);
    return r.rows[0].id;
  });
  return (await getQuiz(db, id))!;
}

export async function updateQuiz(db: Queryable, id: string, input: QuizInput): Promise<Quiz | null> {
  const found = await withTx(db, async (q) => {
    const r = await q.query(
      'UPDATE quizzes SET title = $2, time_limit_sec = $3, updated_at = now() WHERE id = $1',
      [id, input.title, input.timeLimitSec],
    );
    if (r.rowCount === 0) return false;
    await q.query('DELETE FROM questions WHERE quiz_id = $1', [id]);
    await q.query(INSERT_QUESTIONS, [id, JSON.stringify(input.questions)]);
    return true;
  });
  return found ? getQuiz(db, id) : null;
}

export async function deleteQuiz(db: Queryable, id: string): Promise<boolean> {
  const r = await db.query('DELETE FROM quizzes WHERE id = $1', [id]);
  return (r.rowCount ?? 0) > 0;
}
