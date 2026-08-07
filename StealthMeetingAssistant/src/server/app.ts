import http from 'node:http';
import path from 'node:path';
import cors from 'cors';
import express, { type Express } from 'express';
import { WebSocketServer } from 'ws';
import { requireToken, sameOriginOnly } from './auth';
import { authEnabled, loadEnv, port as configuredPort, sessionToken } from './config';
import { chatRouter } from './routes/chat';
import { documentsRouter } from './routes/documents';
import { modelsRouter } from './routes/models';
import { sessionRouter } from './routes/session';
import { getEmbedder } from './rag/embeddings';
import { listDocuments } from './rag/documents';
import { transcript } from './session/transcript';
import type { HealthResponse } from '../shared/types';

const VERSION = '0.1.0';
const startedAt = Date.now();

export function createApp(): Express {
  loadEnv();
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: (_o, cb) => cb(null, true), credentials: false }));
  app.use(express.json({ limit: '2mb' }));
  app.use(sameOriginOnly);

  // Health is unauthenticated so the overlay can wait for the port to open.
  app.get('/api/health', async (_req, res) => {
    let embedder = 'initialising';
    try {
      embedder = (await getEmbedder()).id;
    } catch {
      embedder = 'unavailable';
    }
    const body: HealthResponse = {
      ok: true,
      version: VERSION,
      uptimeMs: Date.now() - startedAt,
      embedder,
      documents: listDocuments().length,
      transcriptLines: transcript.count(),
    };
    res.json(body);
  });

  app.use('/api', requireToken, modelsRouter);
  app.use('/api', requireToken, chatRouter);
  app.use('/api', requireToken, documentsRouter);
  app.use('/api', requireToken, sessionRouter);

  // The overlay is served from here so it has a real http origin (file://
  // pages get null origins and inconsistent fetch behaviour).
  app.use('/', express.static(path.join(__dirname, '..', 'overlay')));

  app.use((req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    res.status(404).send('Not found');
  });

  // Express needs the 4-arg shape to recognise this as an error handler.
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = (err as { status?: number }).status ?? 500;
    if (!res.headersSent) res.status(status).json({ error: err.message });
  });

  return app;
}

export interface RunningServer {
  server: http.Server;
  port: number;
  token: string;
  url: string;
  close(): Promise<void>;
}

/**
 * Start on 127.0.0.1 only. Passing port 0 picks a free port, which is how the
 * Electron main process avoids colliding with whatever else is on 5173.
 */
export function startServer(port = configuredPort()): Promise<RunningServer> {
  const app = createApp();
  const server = http.createServer(app);
  attachTranscriptSocket(server);

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject);
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      resolve({
        server,
        port: actualPort,
        token: sessionToken(),
        url: `http://127.0.0.1:${actualPort}`,
        close: () =>
          new Promise<void>((done) => {
            server.closeAllConnections?.();
            server.close(() => done());
          }),
      });
    });
  });
}

/**
 * WebSocket transcript ingest at /ws/transcript. Accepts the same event shape
 * as the HTTP endpoint and echoes appended lines to every listener, so the
 * overlay updates live while an STT bridge pushes.
 */
function attachTranscriptSocket(server: http.Server): void {
  const wss = new WebSocketServer({ server, path: '/ws/transcript' });

  wss.on('connection', (socket, req) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const presented = url.searchParams.get('token');
    if (authEnabled() && presented !== sessionToken()) {
      socket.close(4401, 'Unauthorized');
      return;
    }

    const onAppend = (line: unknown) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify({ type: 'transcript', line }));
      }
    };
    transcript.on('append', onAppend);
    socket.on('close', () => transcript.off('append', onAppend));

    socket.on('message', (raw) => {
      try {
        const parsed = JSON.parse(String(raw));
        const events = Array.isArray(parsed?.events) ? parsed.events : [parsed];
        for (const event of events) transcript.append(event);
      } catch {
        socket.send(JSON.stringify({ type: 'error', message: 'Expected JSON' }));
      }
    });
  });
}
