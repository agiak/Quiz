import { describe, it, expect } from 'vitest';
import { start, next, close, beginResults, revealNext, cancel, timeFor, checkAnswer, lastRevealStep } from './machine';
import type { GameRecord, TeamRecord } from './model';
import type { Question } from '../../../shared/types';

const q = (t: number | null = null): Question => ({ text: 'q', options: ['a', 'b', 'c'], correctIndex: 0, timeLimitSec: t });
const lobby = (qn = 2, qs?: Question[]): GameRecord => ({
  id: 'g', code: 'ABC', quizTitle: 't', questions: qs ?? Array.from({ length: qn }, () => q()), defaultTimeSec: 30,
  status: 'lobby', step: 0, currentIndex: null, questionEndsAt: null, revealStep: null, teamCountAtReveal: null,
});
const team: TeamRecord = { id: 't', name: 'T', joinedAt: 0, removed: false };
const removedTeam: TeamRecord = { ...team, removed: true };

describe('machine', () => {
  const g1 = start(lobby(), 1000, 0);
  it('start', () => {
    expect(g1).toMatchObject({ status: 'question_open', currentIndex: 0, questionEndsAt: 31_000, step: 1 });
  });
  it('start only from lobby', () => {
    expect(() => start(g1, 1, 1)).toThrow('INVALID');
  });
  it('stale and invalid next', () => {
    expect(() => next(g1, 2000, 0)).toThrow('STALE');
    expect(() => next(g1, 2000, 1)).toThrow('INVALID');
  });
  it('stale checked before state', () => {
    expect(() => start(g1, 1, 0)).toThrow('STALE');
  });
  it('checkAnswer', () => {
    expect(() => checkAnswer(g1, team, 0, 2, 1000 + 30_500)).not.toThrow();
    expect(() => checkAnswer(g1, team, 0, 2, 1000 + 30_501)).toThrow('TIME_UP');
    expect(() => checkAnswer(g1, removedTeam, 0, 2, 1500)).toThrow('TEAM_REMOVED');
    expect(() => checkAnswer(g1, team, 1, 2, 1500)).toThrow('INVALID');
    expect(() => checkAnswer(g1, team, 0, 3, 1500)).toThrow('INVALID');
    expect(() => checkAnswer(g1, team, 0, -1, 1500)).toThrow('INVALID');
    const closed = close(g1, 1);
    expect(() => checkAnswer(closed, team, 0, 2, 1500)).toThrow('TIME_UP');
  });
  it('close', () => {
    const c = close(g1, 1);
    expect(c).toMatchObject({ status: 'question_closed', step: 2, questionEndsAt: 31_000 });
    expect(() => close(g1, 0)).toThrow('STALE');
    expect(close(g1, null).step).toBe(2);
    expect(close(c, null)).toBe(c);
    expect(() => close(c, 2)).toThrow('INVALID');
  });
  it('next opens the following question, not past the last', () => {
    const c = close(g1, 1);
    const n = next(c, 5000, 2);
    expect(n).toMatchObject({ status: 'question_open', currentIndex: 1, questionEndsAt: 35_000, step: 3 });
    const c2 = close(n, 3);
    expect(() => next(c2, 6000, 4)).toThrow('INVALID');
  });
  it('beginResults only after last', () => {
    const c = close(g1, 1);
    expect(() => beginResults(c, 3, 2)).toThrow('INVALID');
    const last = close(next(c, 5000, 2), 3);
    expect(beginResults(last, 3, 4)).toMatchObject({ status: 'revealing', revealStep: 0, teamCountAtReveal: 3, step: 5 });
  });
  it('reveal Q=2,T=3 finishes at step 4', () => {
    const last = close(next(close(g1, 1), 5000, 2), 3);
    let g = beginResults(last, 3, 4);
    const seen: (number | null)[] = [];
    while (g.status === 'revealing') { g = revealNext(g, g.step); seen.push(g.revealStep); }
    expect(seen).toEqual([1, 2, 3, 4]);
    expect(g.status).toBe('finished');
    expect(() => revealNext(g, g.step)).toThrow('INVALID');
  });
  it('reveal T=0 finishes at step 2', () => {
    const last = close(next(close(g1, 1), 5000, 2), 3);
    const g = beginResults(last, 0, 4);
    expect(g.status).toBe('revealing');
    const a = revealNext(g, g.step);
    const b = revealNext(a, a.step);
    expect(a.status).toBe('revealing');
    expect(b).toMatchObject({ status: 'finished', revealStep: 2 });
  });
  it('lastRevealStep', () => {
    expect(lastRevealStep(2, 3)).toBe(4);
    expect(lastRevealStep(2, 0)).toBe(2);
  });
  it('cancel', () => {
    expect(cancel(g1)).toMatchObject({ status: 'cancelled', step: 2 });
    const fin = { ...g1, status: 'finished' as const };
    expect(() => cancel(fin)).toThrow('INVALID');
  });
  it('timeFor', () => {
    const g = lobby(2, [q(), q(60)]);
    expect(timeFor(g, 0)).toBe(30);
    expect(timeFor(g, 1)).toBe(60);
  });
});
