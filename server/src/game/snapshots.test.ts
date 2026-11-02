import { describe, it, expect } from 'vitest';
import { hostState, teamState } from './snapshots';
import type { GameRecord, TeamRecord, AnswerRecord } from './model';
import type { GameStatus, Question } from '../../../shared/types';

const qs: Question[] = [
  { text: 'Πρώτη', options: ['α', 'β', 'γ'], correctIndex: 2, timeLimitSec: null },
  { text: 'Δεύτερη', options: ['α', 'β', 'γ'], correctIndex: 0, timeLimitSec: null },
];
const teams: TeamRecord[] = [
  { id: 't1', name: 'Άλφα', joinedAt: 1, removed: false },
  { id: 't2', name: 'Βήτα', joinedAt: 2, removed: false },
  { id: 't3', name: 'Γάμμα', joinedAt: 3, removed: false },
  { id: 'tx', name: 'Εκτός', joinedAt: 0, removed: true },
];
const answers: AnswerRecord[] = [
  { teamId: 't1', questionIndex: 0, choice: 1 },
  { teamId: 't2', questionIndex: 0, choice: 2 },
  { teamId: 'tx', questionIndex: 0, choice: 2 },
  { teamId: 't2', questionIndex: 1, choice: 0 },
  { teamId: 't1', questionIndex: 1, choice: 0 },
];
const now = 1000;
const gameIn = (status: GameStatus, extra: Partial<GameRecord> = {}): GameRecord => ({
  id: 'g', code: 'ABCD', quizTitle: 'Κουίζ', questions: qs, defaultTimeSec: 20, status, step: 3,
  currentIndex: null, questionEndsAt: null, revealStep: null, teamCountAtReveal: null, ...extra,
});
const open = gameIn('question_open', { currentIndex: 0, questionEndsAt: 5000 });
const revealingAt = (n: number) => gameIn('revealing', { revealStep: n, teamCountAtReveal: 3 });
const finished = gameIn('finished', { revealStep: 4, teamCountAtReveal: 3 });
const team = teams[0];

describe('snapshots', () => {
  it('team state never leaks correctIndex before finish', () => {
    for (const g of [gameIn('lobby'), open, gameIn('question_closed', { currentIndex: 0, questionEndsAt: 5000 }), revealingAt(3)])
      expect(JSON.stringify(teamState(g, team, answers, teams, now))).not.toMatch(/correctIndex/);
  });
  it('host state in question has no per-team answers', () => {
    const h = hostState(open, teams, answers, now);
    expect(JSON.stringify(h)).not.toMatch(/choice/i);
    expect(h.answeredCount).toBe(2);
    expect(h.teams.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    expect(h.current).toEqual({ index: 0, text: 'Πρώτη', options: ['α', 'β', 'γ'], endsAt: 5000 });
    expect(h.serverNow).toBe(now);
    expect(h.reveal).toBeNull();
  });
  it('host reveal progression', () => {
    expect(hostState(revealingAt(0), teams, answers, now).reveal).toMatchObject({ answers: [{ index: 0, correctIndex: 2 }], ranking: [], finished: false });
    const r = hostState(revealingAt(2), teams, answers, now).reveal!;
    expect(r.answers.map((a) => a.index)).toEqual([0, 1]);
    expect(r.ranking).toHaveLength(1);
    expect(r.ranking[0].rank).toBe(3);
    expect(hostState(revealingAt(3), teams, answers, now).reveal!.ranking.map((x) => x.rank)).toEqual([2, 3]);
    expect(hostState(finished, teams, answers, now).reveal).toMatchObject({ finished: true });
    expect(hostState(finished, teams, answers, now).reveal!.ranking).toHaveLength(3);
    expect(hostState(finished, teams, answers, now).current).toBeNull();
  });
  it('team current has myChoice', () => {
    expect(teamState(open, team, answers, teams, now).current).toMatchObject({ index: 0, myChoice: 1, endsAt: 5000 });
    expect(teamState(open, teams[2], answers, teams, now).current!.myChoice).toBeNull();
    expect(teamState(open, team, answers, teams, now).teamName).toBe('Άλφα');
  });
  it('team results only when finished', () => {
    expect(teamState(revealingAt(4), team, answers, teams, now).results).toBeNull();
    const res = teamState(finished, team, answers, teams, now).results!;
    expect(res.review[0]).toMatchObject({ myChoice: 1, correctIndex: 2 });
    expect(res.review[1]).toMatchObject({ myChoice: 0, correctIndex: 0 });
    expect(res.ranking).toHaveLength(3);
    expect(res.me.teamId).toBe('t1');
  });
});
