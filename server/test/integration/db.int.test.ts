import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../../src/db/migrate';
import { createPool } from '../../src/db/pool';
import { createQuiz, deleteQuiz, getQuiz, listQuizzes, updateQuiz, type QuizInput } from '../../src/db/quizzes';
import {
  activeOpenGames, addTeam, createGame, findActiveByCode, listAnswers, listGames, listTeams,
  loadGame, removeTeam, saveGame, teamByToken, upsertAnswer,
} from '../../src/db/games';

const url = process.env.DATABASE_URL_TEST;
if (!url) console.warn('DATABASE_URL_TEST is not set: skipping DB integration tests');

const input: QuizInput = {
  title: 'Γενικές γνώσεις',
  timeLimitSec: 20,
  questions: [
    { text: 'Πρωτεύουσα της Ελλάδας;', options: ['Αθήνα', 'Πάτρα'], correctIndex: 0, timeLimitSec: null },
    { text: 'Δύο και δύο;', options: ['1', '2', '3', '4'], correctIndex: 3, timeLimitSec: 10 },
  ],
};

describe.skipIf(!url)('db', () => {
  const schema = `t_${randomBytes(6).toString('hex')}`;
  let admin: pg.Pool;
  let pool: pg.Pool;

  beforeAll(async () => {
    admin = createPool(url!);
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = createPool(url!, schema);
    await migrate(pool);
  });
  afterAll(async () => {
    await pool?.end();
    await admin?.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin?.end();
  });

  it('migrate is idempotent', async () => {
    await migrate(pool);
    const r = await pool.query('SELECT name FROM schema_migrations');
    expect(r.rows).toEqual([{ name: '001_init.sql' }]);
  });

  it('quiz CRUD keeps question order and nulls', async () => {
    const q = await createQuiz(pool, input);
    expect(q.questions).toEqual(input.questions);
    expect((await getQuiz(pool, q.id))?.title).toBe(input.title);
    expect((await listQuizzes(pool)).some((x) => x.id === q.id)).toBe(true);
    const u = await updateQuiz(pool, q.id, { ...input, title: 'Νέος', questions: [input.questions[1]] });
    expect(u?.title).toBe('Νέος');
    expect(u?.questions).toEqual([input.questions[1]]);
    expect(await updateQuiz(pool, '00000000-0000-0000-0000-000000000000', input)).toBeNull();
    expect(await deleteQuiz(pool, q.id)).toBe(true);
    expect(await getQuiz(pool, q.id)).toBeNull();
  });

  it('game keeps a copy of the questions and survives quiz changes', async () => {
    const quiz = await createQuiz(pool, input);
    const g = await createGame(pool, quiz);
    expect(g.code).toMatch(/^\d{6}$/);
    expect(g.defaultTimeSec).toBe(20);
    await updateQuiz(pool, quiz.id, { ...input, questions: [{ ...input.questions[0], text: 'Άλλο' }] });
    expect((await loadGame(pool, g.id))!.questions[0].text).toBe(quiz.questions[0].text);
    await deleteQuiz(pool, quiz.id);
    expect((await loadGame(pool, g.id))!.questions).toHaveLength(2);
  });

  it('saveGame round-trips fields and sets finished_at', async () => {
    const quiz = await createQuiz(pool, input);
    const g = await createGame(pool, quiz);
    const ends = Date.now() + 20000;
    await saveGame(pool, { ...g, status: 'question_open', step: 1, currentIndex: 0, questionEndsAt: ends });
    const l = (await loadGame(pool, g.id))!;
    expect(l).toMatchObject({ status: 'question_open', step: 1, currentIndex: 0 });
    expect(l.questionEndsAt).toBe(ends);
    expect((await listGames(pool, 'active')).some((x) => x.id === g.id)).toBe(true);
    await saveGame(pool, { ...l, status: 'finished', step: 9, teamCountAtReveal: 3, revealStep: 4 });
    const f = (await listGames(pool, 'past')).find((x) => x.id === g.id)!;
    expect(f.finishedAt).not.toBeNull();
    expect((await listGames(pool, 'active')).some((x) => x.id === g.id)).toBe(false);
    expect(await findActiveByCode(pool, g.code)).toBeNull();
    expect((await activeOpenGames(pool)).some((x) => x.id === g.id)).toBe(false);
  });

  it('findActiveByCode ignores cancelled games', async () => {
    const quiz = await createQuiz(pool, input);
    const g = await createGame(pool, quiz);
    expect((await findActiveByCode(pool, g.code))?.id).toBe(g.id);
    await saveGame(pool, { ...g, status: 'cancelled' });
    expect(await findActiveByCode(pool, g.code)).toBeNull();
  });

  it('teams: unique name by key, token lookup, removal frees the name', async () => {
    const g = await createGame(pool, await createQuiz(pool, input));
    const { team, token } = await addTeam(pool, g.id, '  Αετοί ');
    expect(team.name).toBe('Αετοί');
    await expect(addTeam(pool, g.id, 'ΑΕΤΟΙ')).rejects.toThrow('NAME_TAKEN');
    expect(await teamByToken(pool, token)).toEqual({ team, gameId: g.id });
    expect(await teamByToken(pool, 'nope')).toBeNull();
    expect(await removeTeam(pool, g.id, team.id)).toBe(true);
    expect((await listTeams(pool, g.id))[0].removed).toBe(true);
    const again = await addTeam(pool, g.id, 'ΑΕΤΟΙ');
    expect(again.team.id).not.toBe(team.id);
    expect((await listGames(pool, 'active')).find((x) => x.id === g.id)?.teamCount).toBe(1);
  });

  it('upsertAnswer keeps one row per team and question', async () => {
    const g = await createGame(pool, await createQuiz(pool, input));
    const { team } = await addTeam(pool, g.id, 'Λύκοι');
    await upsertAnswer(pool, { gameId: g.id, teamId: team.id, questionIndex: 0, choice: 1 });
    await upsertAnswer(pool, { gameId: g.id, teamId: team.id, questionIndex: 0, choice: 3 });
    expect(await listAnswers(pool, g.id)).toEqual([
      expect.objectContaining({ teamId: team.id, questionIndex: 0, choice: 3 }),
    ]);
  });
});
