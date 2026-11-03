import { describe, expect, it } from 'vitest';
import { blankDraft, blankQuestion, moveItem, removeOption, validateDraft, type Draft } from './quizForm';

function filled(): Draft {
  return {
    title: '  Γενικές γνώσεις ',
    time: '30',
    questions: [{ ...blankQuestion(), text: 'Πρωτεύουσα;', options: ['Αθήνα', 'Πάτρα'], correctIndex: 0 }],
  };
}

describe('quizForm', () => {
  it('accepts a valid draft and trims text', () => {
    const r = validateDraft(filled());
    expect(r.errors).toBeNull();
    expect(r.input?.title).toBe('Γενικές γνώσεις');
    expect(r.input?.questions[0].timeLimitSec).toBeNull();
  });

  it('reports Greek messages per field', () => {
    const d = blankDraft();
    d.time = '3';
    d.questions[0].time = 'abc';
    const r = validateDraft(d);
    expect(r.errors).not.toBeNull();
    const e = r.errors!;
    expect(e.title).toMatch(/τίτλο/);
    expect(e.timeLimitSec).toMatch(/5 έως 300/);
    expect(e['questions.0.text']).toMatch(/κείμενο/);
    expect(e['questions.0.options.0']).toMatch(/επιλογή/);
    expect(e['questions.0.correctIndex']).toMatch(/σωστή/);
    expect(e['questions.0.timeLimitSec']).toMatch(/5 έως 300/);
  });

  it('requires at least one question', () => {
    const d = filled();
    d.questions = [];
    expect(validateDraft(d).errors?.questions).toMatch(/τουλάχιστον μία/);
  });

  it('keeps the correct answer on the same option when removing one', () => {
    const q = { ...blankQuestion(), options: ['a', 'b', 'c'], correctIndex: 2 };
    expect(removeOption(q, 0)).toMatchObject({ options: ['b', 'c'], correctIndex: 1 });
    expect(removeOption(q, 2).correctIndex).toBeNull();
    expect(removeOption(q, 1).correctIndex).toBe(1);
  });

  it('moves items and ignores moves out of range', () => {
    expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    const same = [1, 2];
    expect(moveItem(same, 0, -1)).toBe(same);
  });
});
