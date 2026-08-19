import http from 'node:http';
import path from 'node:path';
import cors from 'cors';
import express, { type Express } from 'express';
import { WebSocketServer } from 'ws';
import { requireToken, sameOriginOnly } from './auth';
import { authEnabled, loadEnv, port as configuredPort, sessionToken } from './config';
import { audioRouter } from './routes/audio';
import { chatRouter } from './routes/chat';
import { documentsRouter } from './routes/documents';
import { meetingsRouter } from './routes/meetings';
import { modelsRouter } from './routes/models';
import { sessionRouter } from './routes/session';
import { stopAllAudio, writeAudio } from './session/audioSession';
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
  app.use('/api', requireToken, audioRouter);
  app.use('/api', requireToken, meetingsRouter);

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
  attachSockets(server);

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
        close: async () => {
          // Close upstream STT sockets first so they flush their final
          // utterance instead of being cut off mid-word.
          await stopAllAudio();
          await new Promise<void>((done) => {
            server.closeAllConnections?.();
            server.close(() => done());
          });
        },
      });
    });
  });
}

/**
 * Raw PCM ingest at /ws/audio?source=mic|system.
 *
 * Binary frames are 16 kHz mono signed 16-bit little-endian PCM and go
 * straight to the STT engine for that source. Audio is never written to disk
 * and never buffered beyond what the engine needs.
 */
function attachSockets(server: http.Server): void {
  // Both endpoints must share one 'upgrade' listener. Two WebSocketServers
  // bound to the same server with different `path` options do not compose:
  // whichever sees the request first aborts the handshake with 400 when the
  // path is not its own.
  const audioWss = new WebSocketServer({ noServer: true, maxPayload: 1 << 20 });
  const transcriptWss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url ?? '/', 'http://127.0.0.1');
    const wss =
      pathname === '/ws/audio'
        ? audioWss
        : pathname === '/ws/transcript'
          ? transcriptWss
          : undefined;

    if (!wss) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (client) => wss.emit('connection', client, req));
  });

  audioWss.on('connection', (socket, req) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (authEnabled() && url.searchParams.get('token') !== sessionToken()) {
      socket.close(4401, 'Unauthorized');
      return;
    }

    const source = url.searchParams.get('source');
    if (source !== 'mic' && source !== 'system') {
      socket.close(4400, 'source must be mic or system');
      return;
    }

    socket.on('message', (raw, isBinary) => {
      if (!isBinary) return; // control messages go over HTTP, not here
      const pcm = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
      if (!writeAudio(source, pcm)) {
        // No session open for this source — tell the renderer to stop sending
        // rather than silently discarding the user's audio.
        socket.send(JSON.stringify({ type: 'inactive', source }));
      }
    });
  });

  /**
   * Transcript ingest at /ws/transcript. Accepts the same event shape as the
   * HTTP endpoint and echoes appended lines to every listener, so the overlay
   * updates live while an STT bridge pushes.
   */
  transcriptWss.on('connection', (socket, req) => {
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
