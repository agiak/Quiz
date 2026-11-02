import type { Question, RankRow } from '../../../shared/types';
import type { AnswerRecord, TeamRecord } from './model';

export function rank(teams: TeamRecord[], answers: AnswerRecord[], questions: Question[]): RankRow[] {
  const active = teams.filter((t) => !t.removed);
  const scores = new Map<string, number>(active.map((t) => [t.id, 0]));
  for (const a of answers) {
    const q = questions[a.questionIndex];
    if (!q || a.choice !== q.correctIndex) continue;
    const s = scores.get(a.teamId);
    if (s !== undefined) scores.set(a.teamId, s + 1);
  }
  const sorted = active
    .map((t) => ({ teamId: t.id, name: t.name, score: scores.get(t.id) ?? 0 }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'el'));
  const rows: RankRow[] = [];
  sorted.forEach((r, i) => {
    const tied = i > 0 && sorted[i - 1].score === r.score;
    rows.push({ ...r, rank: tied ? rows[i - 1].rank : i + 1 });
  });
  return rows;
}
