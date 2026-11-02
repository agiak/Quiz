import { describe, it, expect } from 'vitest';
import { rank } from './scoring';
import type { TeamRecord, AnswerRecord } from './model';
import type { Question } from '../../../shared/types';

const q = (correctIndex: number): Question => ({ text: 'q', options: ['a', 'b', 'c'], correctIndex, timeLimitSec: null });
const qs = [q(0), q(1)];
const team = (id: string, name: string, removed = false): TeamRecord => ({ id, name, joinedAt: 0, removed });

describe('rank', () => {
  it('uses competition ranking for ties', () => {
    const teams = [team('a', 'Α'), team('b', 'Β'), team('c', 'Γ')];
    const answers: AnswerRecord[] = [
      { teamId: 'a', questionIndex: 0, choice: 0 },
      { teamId: 'b', questionIndex: 0, choice: 0 },
    ];
    const r = rank(teams, answers, qs);
    expect(r.map((x) => x.rank)).toEqual([1, 1, 3]);
    expect(r.map((x) => x.teamId)).toEqual(['a', 'b', 'c']);
  });
  it('excludes removed teams and ignores their and unknown answers', () => {
    const teams = [team('a', 'Α'), team('r', 'Β', true)];
    const answers: AnswerRecord[] = [
      { teamId: 'r', questionIndex: 0, choice: 0 },
      { teamId: 'zzz', questionIndex: 0, choice: 0 },
    ];
    const r = rank(teams, answers, qs);
    expect(r.find((x) => x.teamId === 'r')).toBeUndefined();
    expect(r).toHaveLength(1);
    expect(r[0].score).toBe(0);
  });
  it('late team missing answers scores 0; sorts by score desc then name', () => {
    const teams = [team('a', 'Ωμέγα'), team('b', 'Άλφα'), team('c', 'Βήτα')];
    const answers: AnswerRecord[] = [
      { teamId: 'a', questionIndex: 0, choice: 0 },
      { teamId: 'a', questionIndex: 1, choice: 1 },
      { teamId: 'b', questionIndex: 1, choice: 2 },
    ];
    const r = rank(teams, answers, qs);
    expect(r.map((x) => [x.teamId, x.score, x.rank])).toEqual([['a', 2, 1], ['b', 0, 2], ['c', 0, 2]]);
  });
});
