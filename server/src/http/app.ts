import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import type { Config } from '../config';
import type { Queryable } from '../db/pool';
import { GameError } from '../game/model';
import { buildRoutes } from './routes';

export interface GameControl {
  cancel(gameId: string): Promise<void>;
}

export interface AppDeps {
  config: Config;
  db: Queryable;
  games: GameControl;
}

export function createApp(deps: AppDeps): express.Express {
  const app = express();
  app.use(cors({ origin: deps.config.webOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/api', buildRoutes(deps));

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (res.headersSent) return;
    if (err instanceof ZodError) return void res.status(400).json({ error: 'INVALID' });
    if (err instanceof GameError) return void res.status(400).json({ error: err.code });
    if (err?.type === 'entity.parse.failed') return void res.status(400).json({ error: 'INVALID' });
    if (err?.type === 'entity.too.large') return void res.status(413).json({ error: 'INVALID' });
    console.error(err);
    res.status(500).json({ error: 'INVALID' });
  };
  app.use(onError);
  return app;
}
