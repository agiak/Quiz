import { describe, expect, it } from 'vitest';
import { answerSchema, hostActionSchema, joinSchema, quizInputSchema } from './schemas';
import { ERROR_TEXT } from './errors';

const q = (over: Record<string, unknown> = {}) => ({
  text: 'Πρωτεύουσα της Ελλάδας;',
  options: ['Αθήνα', 'Πάτρα'],
  correctIndex: 0,
  timeLimitSec: null,
  ...over,
});
const quiz = (over: Record<string, unknown> = {}) => ({
  title: 'Κουίζ',
  timeLimitSec: 30,
  questions: [q()],
  ...over,
});

describe('quizInputSchema', () => {
  it('accepts a valid quiz', () => {
    expect(quizInputSchema.safeParse(quiz()).success).toBe(true);
    expect(
      quizInputSchema.safeParse(
        quiz({ questions: [q({ options: ['α', 'β', 'γ', 'δ'], correctIndex: 3, timeLimitSec: 5 })] }),
      ).success,
    ).toBe(true);
  });
  it('rejects 1 option', () => {
    expect(quizInputSchema.safeParse(quiz({ questions: [q({ options: ['α'] })] })).success).toBe(false);
  });
  it('rejects 5 options', () => {
    expect(
      quizInputSchema.safeParse(quiz({ questions: [q({ options: ['α', 'β', 'γ', 'δ', 'ε'] })] })).success,
    ).toBe(false);
  });
  it('rejects correctIndex out of bounds', () => {
    expect(quizInputSchema.safeParse(quiz({ questions: [q({ correctIndex: 2 })] })).success).toBe(false);
    expect(quizInputSchema.safeParse(quiz({ questions: [q({ correctIndex: -1 })] })).success).toBe(false);
  });
  it('rejects empty option', () => {
    expect(quizInputSchema.safeParse(quiz({ questions: [q({ options: ['α', '  '] })] })).success).toBe(false);
  });
  it('rejects timeLimitSec 4 or 301 (quiz and question)', () => {
    expect(quizInputSchema.safeParse(quiz({ timeLimitSec: 4 })).success).toBe(false);
    expect(quizInputSchema.safeParse(quiz({ timeLimitSec: 301 })).success).toBe(false);
    expect(quizInputSchema.safeParse(quiz({ questions: [q({ timeLimitSec: 4 })] })).success).toBe(false);
    expect(quizInputSchema.safeParse(quiz({ questions: [q({ timeLimitSec: 301 })] })).success).toBe(false);
  });
  it('rejects empty title, empty questions, empty question text', () => {
    expect(quizInputSchema.safeParse(quiz({ title: '' })).success).toBe(false);
    expect(quizInputSchema.safeParse(quiz({ questions: [] })).success).toBe(false);
    expect(quizInputSchema.safeParse(quiz({ questions: [q({ text: ' ' })] })).success).toBe(false);
  });
});

describe('joinSchema', () => {
  it('accepts a valid join and cleans the name', () => {
    const r = joinSchema.safeParse({ code: '123456', name: '  Οι   Σοφοί ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe('Οι Σοφοί');
  });
  it('rejects bad code', () => {
    expect(joinSchema.safeParse({ code: '12345', name: 'Α' }).success).toBe(false);
    expect(joinSchema.safeParse({ code: '12345a', name: 'Α' }).success).toBe(false);
  });
  it('rejects empty name and 31-char name, accepts 30', () => {
    expect(joinSchema.safeParse({ code: '123456', name: '   ' }).success).toBe(false);
    expect(joinSchema.safeParse({ code: '123456', name: 'α'.repeat(31) }).success).toBe(false);
    expect(joinSchema.safeParse({ code: '123456', name: 'α'.repeat(30) }).success).toBe(true);
  });
});

describe('answerSchema', () => {
  it('validates range', () => {
    expect(answerSchema.safeParse({ questionIndex: 0, choice: 3 }).success).toBe(true);
    expect(answerSchema.safeParse({ questionIndex: -1, choice: 0 }).success).toBe(false);
    expect(answerSchema.safeParse({ questionIndex: 0, choice: 4 }).success).toBe(false);
    expect(answerSchema.safeParse({ questionIndex: 0.5, choice: 0 }).success).toBe(false);
  });
});

describe('hostActionSchema', () => {
  it('validates', () => {
    expect(hostActionSchema.safeParse({ gameId: 'g1', expectStep: 3 }).success).toBe(true);
    expect(hostActionSchema.safeParse({ gameId: 'g1', expectStep: 1.5 }).success).toBe(false);
    expect(hostActionSchema.safeParse({ gameId: 'g1' }).success).toBe(false);
  });
});

describe('ERROR_TEXT', () => {
  it('has Greek text for every code', () => {
    expect(Object.keys(ERROR_TEXT)).toHaveLength(10);
    expect(ERROR_TEXT.GAME_NOT_FOUND).toBe('Δεν βρέθηκε παιχνίδι με αυτόν τον κωδικό.');
    for (const v of Object.values(ERROR_TEXT)) expect(v.length).toBeGreaterThan(0);
  });
});
