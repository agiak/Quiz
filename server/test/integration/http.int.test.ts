import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../../src/db/migrate';
import { createPool } from '../../src/db/pool';
import { createApp } from '../../src/http/app';

const url = process.env.DATABASE_URL_TEST;
if (!url) console.warn('DATABASE_URL_TEST is not set: skipping HTTP integration tests');

const config = {
  databaseUrl: 'unused', adminPassword: 'pw', sessionSecret: 'sec', webOrigin: 'https://web.example', port: 0,
};
const quiz = {
  title: 'Κουίζ',
  timeLimitSec: 20,
  questions: [
    { text: 'Α;', options: ['1', '2'], correctIndex: 1, timeLimitSec: null },
  ],
};

describe.skipIf(!url)('http', () => {
  const schema = `t_${randomBytes(6).toString('hex')}`;
  let admin: pg.Pool;
  let pool: pg.Pool;
  const cancelled: string[] = [];
  let app: ReturnType<typeof createApp>;
  let auth: { Authorization: string };

  beforeAll(async () => {
    admin = createPool(url!);
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = createPool(url!, schema);
    await migrate(pool);
    app = createApp({ config, db: pool, games: { cancel: async (id) => void cancelled.push(id) } });
    const r = await request(app).post('/api/admin/login').send({ password: 'pw' });
    auth = { Authorization: `Bearer ${r.body.token}` };
  });
  afterAll(async () => {
    await pool?.end();
    await admin?.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin?.end();
  });

  it('health needs no auth', async () => {
    const r = await request(app).get('/health');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
  });

  it('login rejects a wrong password and malformed bodies', async () => {
    const r = await request(app).post('/api/admin/login').send({ password: 'nope' });
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ error: 'BAD_PASSWORD' });
    const bad = await request(app).post('/api/admin/login').set('Content-Type', 'application/json').send('{oops');
    expect(bad.status).toBe(400);
    expect(bad.body).toEqual({ error: 'INVALID' });
  });

  it('requires the admin token', async () => {
    for (const r of [
      await request(app).get('/api/quizzes'),
      await request(app).get('/api/quizzes').set('Authorization', 'Bearer junk'),
      await request(app).get('/api/games?status=active'),
    ]) {
      expect(r.status).toBe(401);
      expect(r.body).toEqual({ error: 'UNAUTHORIZED' });
    }
  });

  it('only allows the configured CORS origin', async () => {
    const ok = await request(app).get('/health').set('Origin', 'https://web.example');
    expect(ok.headers['access-control-allow-origin']).toBe('https://web.example');
    const other = await request(app).get('/health').set('Origin', 'https://evil.example');
    expect(other.headers['access-control-allow-origin']).toBe('https://web.example'); // never echoes the caller
  });

  it('quiz CRUD', async () => {
    const created = await request(app).post('/api/quizzes').set(auth).send(quiz);
    expect(created.status).toBe(201);
    const id = created.body.id as string;
    expect(created.body.questions).toHaveLength(1);

    const list = await request(app).get('/api/quizzes').set(auth);
    expect(list.body.map((q: { id: string }) => q.id)).toContain(id);

    const got = await request(app).get(`/api/quizzes/${id}`).set(auth);
    expect(got.body.title).toBe('Κουίζ');

    const put = await request(app).put(`/api/quizzes/${id}`).set(auth).send({ ...quiz, title: 'Νέο' });
    expect(put.status).toBe(200);
    expect(put.body.title).toBe('Νέο');

    const invalid = await request(app).post('/api/quizzes').set(auth).send({ title: '' });
    expect(invalid.status).toBe(400);
    expect(invalid.body).toEqual({ error: 'INVALID' });

    expect((await request(app).delete(`/api/quizzes/${id}`).set(auth)).status).toBe(204);
    expect((await request(app).get(`/api/quizzes/${id}`).set(auth)).status).toBe(404);
    expect((await request(app).get('/api/quizzes/not-a-uuid').set(auth)).body).toEqual({ error: 'INVALID' });
  });

  it('creates games, lists them, cancels and returns results', async () => {
    const q = await request(app).post('/api/quizzes').set(auth).send(quiz);
    const g = await request(app).post(`/api/quizzes/${q.body.id}/games`).set(auth);
    expect(g.status).toBe(201);
    expect(g.body.code).toMatch(/^\d{6}$/);

    const active = await request(app).get('/api/games?status=active').set(auth);
    expect(active.body.map((x: { id: string }) => x.id)).toContain(g.body.id);
    expect((await request(app).get('/api/games?status=zzz').set(auth)).status).toBe(400);

    const res = await request(app).get(`/api/games/${g.body.id}/results`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ quizTitle: 'Κουίζ', finishedAt: null, ranking: [] });
    const missing = await request(app).get('/api/games/00000000-0000-4000-8000-000000000000/results').set(auth);
    expect(missing.status).toBe(404);

    expect((await request(app).post(`/api/games/${g.body.id}/cancel`).set(auth)).status).toBe(204);
    expect(cancelled).toEqual([g.body.id]);

    const none = await request(app).post('/api/quizzes/00000000-0000-4000-8000-000000000000/games').set(auth);
    expect(none.status).toBe(404);
    expect(none.body).toEqual({ error: 'INVALID' });
  });

  it('rejects starting a game for a quiz without questions', async () => {
    const q = await pool.query<{ id: string }>(
      "INSERT INTO quizzes (title, time_limit_sec) VALUES ('Άδειο', 20) RETURNING id",
    );
    const r = await request(app).post(`/api/quizzes/${q.rows[0].id}/games`).set(auth);
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: 'INVALID' });
  });
});
