import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { loadConfig } from './config';
import { migrate } from './db/migrate';
import { createPool } from './db/pool';
import { createApp } from './http/app';
import { GameService } from './realtime/service';
import { attachSockets, type Gateway } from './realtime/sockets';
import { createTimers } from './realtime/timers';

const config = loadConfig(process.env);
const pool = createPool(config.databaseUrl);
await migrate(pool);

let gateway: Gateway | undefined;
const service = new GameService({
  db: pool,
  timers: createTimers(),
  publish: (gameId) => gateway?.publish(gameId),
  teamRemoved: (gameId, teamId) => gateway?.teamRemoved(gameId, teamId),
});
const app = createApp({ config, db: pool, games: service });
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: config.webOrigin } });
gateway = attachSockets(io, service, config);
await service.recover();

httpServer.listen(config.port, () => {
  console.log(`Quiz Night server listening on port ${config.port}`);
});
