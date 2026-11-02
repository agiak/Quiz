import { ANSWER_GRACE_MS } from '../../../shared/constants';
import { GameError, type GameRecord, type TeamRecord } from './model';

export function timeFor(g: GameRecord, i: number): number {
  return g.questions[i].timeLimitSec ?? g.defaultTimeSec;
}

export function lastRevealStep(questionCount: number, teamCount: number): number {
  return teamCount > 0 ? questionCount + teamCount - 1 : questionCount;
}

function guard(g: GameRecord, expectStep: number): void {
  if (expectStep !== g.step) throw new GameError('STALE');
}

function bump(g: GameRecord, patch: Partial<GameRecord>): GameRecord {
  return { ...g, ...patch, step: g.step + 1 };
}

export function start(g: GameRecord, now: number, expectStep: number): GameRecord {
  guard(g, expectStep);
  if (g.status !== 'lobby') throw new GameError('INVALID');
  return bump(g, { status: 'question_open', currentIndex: 0, questionEndsAt: now + timeFor(g, 0) * 1000 });
}

export function next(g: GameRecord, now: number, expectStep: number): GameRecord {
  guard(g, expectStep);
  if (g.status !== 'question_closed' || g.currentIndex === null || g.currentIndex + 1 >= g.questions.length) {
    throw new GameError('INVALID');
  }
  const i = g.currentIndex + 1;
  return bump(g, { status: 'question_open', currentIndex: i, questionEndsAt: now + timeFor(g, i) * 1000 });
}

export function close(g: GameRecord, expectStep: number | null): GameRecord {
  if (expectStep === null) {
    if (g.status !== 'question_open') return g;
  } else {
    guard(g, expectStep);
    if (g.status !== 'question_open') throw new GameError('INVALID');
  }
  return bump(g, { status: 'question_closed' });
}

export function beginResults(g: GameRecord, activeTeams: number, expectStep: number): GameRecord {
  guard(g, expectStep);
  if (g.status !== 'question_closed' || g.currentIndex !== g.questions.length - 1) throw new GameError('INVALID');
  return bump(g, { status: 'revealing', revealStep: 0, teamCountAtReveal: activeTeams });
}

export function revealNext(g: GameRecord, expectStep: number): GameRecord {
  guard(g, expectStep);
  if (g.status !== 'revealing' || g.revealStep === null) throw new GameError('INVALID');
  const last = lastRevealStep(g.questions.length, g.teamCountAtReveal ?? 0);
  const n = g.revealStep + 1;
  return n >= last ? bump(g, { status: 'finished', revealStep: last }) : bump(g, { revealStep: n });
}

export function cancel(g: GameRecord): GameRecord {
  if (g.status === 'finished' || g.status === 'cancelled') throw new GameError('INVALID');
  return bump(g, { status: 'cancelled' });
}

export function checkAnswer(g: GameRecord, team: TeamRecord, questionIndex: number, choice: number, now: number): void {
  if (team.removed) throw new GameError('TEAM_REMOVED');
  if (g.status !== 'question_open') throw new GameError('TIME_UP');
  if (questionIndex !== g.currentIndex) throw new GameError('INVALID');
  const q = g.questions[questionIndex];
  if (!Number.isInteger(choice) || choice < 0 || choice >= q.options.length) throw new GameError('INVALID');
  if (g.questionEndsAt !== null && now > g.questionEndsAt + ANSWER_GRACE_MS) throw new GameError('TIME_UP');
}
