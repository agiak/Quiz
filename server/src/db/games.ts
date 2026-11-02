import { randomBytes, randomInt } from 'node:crypto';
import type { GameStatus, Question, Quiz } from '../../../shared/types';
import { cleanTeamName, nameKey } from '../../../shared/names';
import { GameError, type AnswerRecord, type GameRecord, type TeamRecord } from '../game/model';
import type { Queryable } from './pool';

const isUnique = (e: unknown) => (e as { code?: string } | null)?.code === '23505';

interface GameRow {
  id: string; code: string; quiz_title: string; questions: Question[]; default_time_sec: number;
  status: GameStatus; step: number; current_index: number | null; question_ends_at: Date | null;
  reveal_step: number | null; team_count_at_reveal: number | null;
}
const GAME_COLS =
  'id, code, quiz_title, questions, default_time_sec, status, step, current_index, question_ends_at, reveal_step, team_count_at_reveal';

const toGame = (r: GameRow): GameRecord => ({
  id: r.id,
  code: r.code,
  quizTitle: r.quiz_title,
  questions: r.questions,
  defaultTimeSec: r.default_time_sec,
  status: r.status,
  step: r.step,
  currentIndex: r.current_index,
  questionEndsAt: r.question_ends_at ? r.question_ends_at.getTime() : null,
  revealStep: r.reveal_step,
  teamCountAtReveal: r.team_count_at_reveal,
});

interface TeamRow { id: string; name: string; joined_at: Date; removed_at: Date | null }
const TEAM_COLS = 'id, name, joined_at, removed_at';
const toTeam = (r: TeamRow): TeamRecord => ({
  id: r.id,
  name: r.name,
  joinedAt: r.joined_at.getTime(),
  removed: r.removed_at !== null,
});

export async function createGame(db: Queryable, quiz: Quiz): Promise<GameRecord> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = String(randomInt(100000, 1000000));
    try {
      const r = await db.query<GameRow>(
        `INSERT INTO games (quiz_id, quiz_title, code, questions, default_time_sec)
         VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING ${GAME_COLS}`,
        [quiz.id, quiz.title, code, JSON.stringify(quiz.questions), quiz.timeLimitSec],
      );
      return toGame(r.rows[0]);
    } catch (e) {
      if (!isUnique(e)) throw e;
    }
  }
  throw new Error('Could not allocate a unique game code');
}

export async function loadGame(db: Queryable, id: string): Promise<GameRecord | null> {
  const r = await db.query<GameRow>(`SELECT ${GAME_COLS} FROM games WHERE id = $1`, [id]);
  return r.rows[0] ? toGame(r.rows[0]) : null;
}

export async function findActiveByCode(db: Queryable, code: string): Promise<GameRecord | null> {
  const r = await db.query<GameRow>(
    `SELECT ${GAME_COLS} FROM games WHERE code = $1 AND status NOT IN ('finished','cancelled')`,
    [code],
  );
  return r.rows[0] ? toGame(r.rows[0]) : null;
}

/** True when some game (finished and cancelled ones included) ever used this code. */
export async function codeWasUsed(db: Queryable, code: string): Promise<boolean> {
  const r = await db.query('SELECT 1 FROM games WHERE code = $1 LIMIT 1', [code]);
  return (r.rowCount ?? 0) > 0;
}

export async function saveGame(db: Queryable, g: GameRecord): Promise<void> {
  await db.query(
    `UPDATE games SET status = $2, step = $3, current_index = $4,
       question_ends_at = $5, reveal_step = $6, team_count_at_reveal = $7,
       finished_at = CASE WHEN $2 = 'finished' THEN COALESCE(finished_at, now()) ELSE finished_at END
     WHERE id = $1`,
    [
      g.id, g.status, g.step, g.currentIndex,
      g.questionEndsAt === null ? null : new Date(g.questionEndsAt),
      g.revealStep, g.teamCountAtReveal,
    ],
  );
}

export interface GameListRow {
  id: string;
  code: string;
  quizTitle: string;
  status: GameStatus;
  createdAt: string;
  finishedAt: string | null;
  teamCount: number;
}

export async function listGames(db: Queryable, kind: 'active' | 'past'): Promise<GameListRow[]> {
  const where = kind === 'active' ? "g.status NOT IN ('finished','cancelled')" : "g.status = 'finished'";
  const r = await db.query<{
    id: string; code: string; quiz_title: string; status: GameStatus;
    created_at: Date; finished_at: Date | null; team_count: number;
  }>(
    `SELECT g.id, g.code, g.quiz_title, g.status, g.created_at, g.finished_at,
            (SELECT count(*)::int FROM teams t WHERE t.game_id = g.id AND t.removed_at IS NULL) AS team_count
     FROM games g WHERE ${where} ORDER BY g.created_at DESC`,
  );
  return r.rows.map((x) => ({
    id: x.id,
    code: x.code,
    quizTitle: x.quiz_title,
    status: x.status,
    createdAt: x.created_at.toISOString(),
    finishedAt: x.finished_at ? x.finished_at.toISOString() : null,
    teamCount: x.team_count,
  }));
}

/** All games that have not finished or been cancelled (used at startup to restore timers). */
export async function activeOpenGames(db: Queryable): Promise<GameRecord[]> {
  const r = await db.query<GameRow>(
    `SELECT ${GAME_COLS} FROM games WHERE status NOT IN ('finished','cancelled') ORDER BY created_at`,
  );
  return r.rows.map(toGame);
}

export async function addTeam(
  db: Queryable,
  gameId: string,
  rawName: string,
): Promise<{ team: TeamRecord; token: string }> {
  const name = cleanTeamName(rawName);
  const token = randomBytes(24).toString('base64url');
  try {
    const r = await db.query<TeamRow>(
      `INSERT INTO teams (game_id, name, name_key, token) VALUES ($1, $2, $3, $4) RETURNING ${TEAM_COLS}`,
      [gameId, name, nameKey(name), token],
    );
    return { team: toTeam(r.rows[0]), token };
  } catch (e) {
    if (isUnique(e)) throw new GameError('NAME_TAKEN');
    throw e;
  }
}

export async function teamByToken(
  db: Queryable,
  token: string,
): Promise<{ team: TeamRecord; gameId: string } | null> {
  const r = await db.query<TeamRow & { game_id: string }>(
    `SELECT ${TEAM_COLS}, game_id FROM teams WHERE token = $1`,
    [token],
  );
  return r.rows[0] ? { team: toTeam(r.rows[0]), gameId: r.rows[0].game_id } : null;
}

/** All teams of the game, removed ones included (flagged), oldest first. */
export async function listTeams(db: Queryable, gameId: string): Promise<TeamRecord[]> {
  const r = await db.query<TeamRow>(
    `SELECT ${TEAM_COLS} FROM teams WHERE game_id = $1 ORDER BY joined_at, id`,
    [gameId],
  );
  return r.rows.map(toTeam);
}

export async function removeTeam(db: Queryable, gameId: string, teamId: string): Promise<boolean> {
  const r = await db.query(
    'UPDATE teams SET removed_at = now() WHERE id = $1 AND game_id = $2 AND removed_at IS NULL',
    [teamId, gameId],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function upsertAnswer(db: Queryable, a: AnswerRecord & { gameId: string }): Promise<void> {
  await db.query(
    `INSERT INTO answers (game_id, team_id, question_index, choice) VALUES ($1, $2, $3, $4)
     ON CONFLICT (team_id, question_index) DO UPDATE SET choice = EXCLUDED.choice, updated_at = now()`,
    [a.gameId, a.teamId, a.questionIndex, a.choice],
  );
}

export async function listAnswers(db: Queryable, gameId: string): Promise<AnswerRecord[]> {
  const r = await db.query<{ team_id: string; question_index: number; choice: number }>(
    'SELECT team_id, question_index, choice FROM answers WHERE game_id = $1 ORDER BY question_index, team_id',
    [gameId],
  );
  return r.rows.map((x) => ({ teamId: x.team_id, questionIndex: x.question_index, choice: x.choice }));
}
