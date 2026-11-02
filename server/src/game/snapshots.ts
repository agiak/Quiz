import type { HostState, TeamState } from '../../../shared/types';
import type { GameRecord, TeamRecord, AnswerRecord } from './model';
import { rank } from './scoring';

function activeTeams(teams: TeamRecord[]): TeamRecord[] {
  return teams.filter((t) => !t.removed).sort((a, b) => a.joinedAt - b.joinedAt);
}

function hasCurrent(g: GameRecord): g is GameRecord & { currentIndex: number; questionEndsAt: number } {
  return (
    (g.status === 'question_open' || g.status === 'question_closed') &&
    g.currentIndex !== null &&
    g.questionEndsAt !== null
  );
}

function choiceOf(answers: AnswerRecord[], teamId: string, index: number): number | null {
  let found: number | null = null;
  for (const a of answers) if (a.teamId === teamId && a.questionIndex === index) found = a.choice;
  return found;
}

export function hostState(g: GameRecord, teams: TeamRecord[], answers: AnswerRecord[], now: number): HostState {
  const active = activeTeams(teams);
  const Q = g.questions.length;
  let current: HostState['current'] = null;
  let answeredCount = 0;
  if (hasCurrent(g)) {
    const q = g.questions[g.currentIndex];
    current = { index: g.currentIndex, text: q.text, options: q.options, endsAt: g.questionEndsAt };
    const ids = new Set(active.map((t) => t.id));
    const answered = new Set<string>();
    for (const a of answers) if (a.questionIndex === g.currentIndex && ids.has(a.teamId)) answered.add(a.teamId);
    answeredCount = answered.size;
  }
  let reveal: HostState['reveal'] = null;
  if (g.status === 'revealing' || g.status === 'finished') {
    const finished = g.status === 'finished';
    const step = g.revealStep ?? 0;
    const upTo = finished ? Q - 1 : Math.min(step, Q - 1);
    const shown = g.questions.slice(0, upTo + 1).map((q, index) => ({
      index,
      text: q.text,
      options: q.options,
      correctIndex: q.correctIndex,
    }));
    const full = rank(active, answers, g.questions);
    const n = finished ? full.length : Math.max(0, step - Q + 1);
    reveal = { answers: shown, ranking: n > 0 ? full.slice(-n) : [], finished };
  }
  return {
    role: 'host',
    gameId: g.id,
    status: g.status,
    code: g.code,
    quizTitle: g.quizTitle,
    questionCount: Q,
    teams: active.map((t) => ({ id: t.id, name: t.name })),
    step: g.step,
    serverNow: now,
    current,
    answeredCount,
    reveal,
  };
}

export function teamState(
  g: GameRecord,
  team: TeamRecord,
  answers: AnswerRecord[],
  teams: TeamRecord[],
  now: number,
): TeamState {
  let current: TeamState['current'] = null;
  if (hasCurrent(g)) {
    const q = g.questions[g.currentIndex];
    current = {
      index: g.currentIndex,
      text: q.text,
      options: q.options,
      endsAt: g.questionEndsAt,
      myChoice: choiceOf(answers, team.id, g.currentIndex),
    };
  }
  let results: TeamState['results'] = null;
  if (g.status === 'finished') {
    const ranking = rank(activeTeams(teams), answers, g.questions);
    const me = ranking.find((r) => r.teamId === team.id);
    if (me) {
      results = {
        me,
        ranking,
        review: g.questions.map((q, index) => ({
          index,
          text: q.text,
          options: q.options,
          myChoice: choiceOf(answers, team.id, index),
          correctIndex: q.correctIndex,
        })),
      };
    }
  }
  return {
    role: 'team',
    status: g.status,
    teamName: team.name,
    questionCount: g.questions.length,
    serverNow: now,
    current,
    results,
  };
}
