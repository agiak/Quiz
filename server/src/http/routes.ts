import { Router, type NextFunction, type Request, type Response } from 'express';
import { quizInputSchema } from '../../../shared/schemas';
import { createGame, listAnswers, listGames, listTeams, loadGame } from '../db/games';
import { createQuiz, deleteQuiz, getQuiz, listQuizzes, updateQuiz } from '../db/quizzes';
import { rank } from '../game/scoring';
import { checkPassword, requireAdmin, signAdminToken } from './auth';
import type { AppDeps } from './app';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Handler = (req: Request, res: Response) => Promise<unknown> | unknown;

// Express 4 does not forward rejected promises to the error handler.
const h = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve()
    .then(() => fn(req, res))
    .catch(next);
};

export function buildRoutes({ config, db, games }: AppDeps): Router {
  const r = Router();

  r.post('/admin/login', h((req, res) => {
    const pw = req.body?.password;
    if (typeof pw !== 'string' || !checkPassword(config.adminPassword, pw)) {
      return res.status(401).json({ error: 'BAD_PASSWORD' });
    }
    res.json({ token: signAdminToken(config.sessionSecret, Date.now()) });
  }));

  r.use(requireAdmin(config.sessionSecret));

  // Ids are uuids: anything else cannot exist (and would make Postgres throw).
  r.param('id', (_req, res, next, id) => {
    if (!UUID.test(id)) {
      res.status(404).json({ error: 'INVALID' });
      return;
    }
    next();
  });

  r.get('/quizzes', h(async (_req, res) => res.json(await listQuizzes(db))));

  r.post('/quizzes', h(async (req, res) => {
    const input = quizInputSchema.parse(req.body);
    res.status(201).json(await createQuiz(db, input));
  }));

  r.get('/quizzes/:id', h(async (req, res) => {
    const quiz = await getQuiz(db, req.params.id);
    if (!quiz) return res.status(404).json({ error: 'INVALID' });
    res.json(quiz);
  }));

  r.put('/quizzes/:id', h(async (req, res) => {
    const input = quizInputSchema.parse(req.body);
    const quiz = await updateQuiz(db, req.params.id, input);
    if (!quiz) return res.status(404).json({ error: 'INVALID' });
    res.json(quiz);
  }));

  r.delete('/quizzes/:id', h(async (req, res) => {
    if (!(await deleteQuiz(db, req.params.id))) return res.status(404).json({ error: 'INVALID' });
    res.status(204).end();
  }));

  r.post('/quizzes/:id/games', h(async (req, res) => {
    const quiz = await getQuiz(db, req.params.id);
    if (!quiz) return res.status(404).json({ error: 'INVALID' });
    if (quiz.questions.length === 0) return res.status(400).json({ error: 'INVALID' });
    const game = await createGame(db, quiz);
    res.status(201).json({ id: game.id, code: game.code });
  }));

  r.get('/games', h(async (req, res) => {
    const status = req.query.status;
    if (status !== 'active' && status !== 'past') return res.status(400).json({ error: 'INVALID' });
    res.json(await listGames(db, status));
  }));

  r.post('/games/:id/cancel', h(async (req, res) => {
    await games.cancel(req.params.id);
    res.status(204).end();
  }));

  r.get('/games/:id/results', h(async (req, res) => {
    const game = await loadGame(db, req.params.id);
    if (!game) return res.status(404).json({ error: 'GAME_NOT_FOUND' });
    const [teams, answers, fin] = await Promise.all([
      listTeams(db, game.id),
      listAnswers(db, game.id),
      db.query<{ finished_at: Date | null }>('SELECT finished_at FROM games WHERE id = $1', [game.id]),
    ]);
    const finishedAt = fin.rows[0]?.finished_at ?? null;
    res.json({
      quizTitle: game.quizTitle,
      finishedAt: finishedAt ? finishedAt.toISOString() : null,
      ranking: rank(teams, answers, game.questions),
    });
  }));

  return r;
}
