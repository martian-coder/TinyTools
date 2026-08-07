import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import {
  deleteDocument,
  documentEvents,
  ingestDocument,
  listDocuments,
} from '../rag/documents';
import { isSupported, SUPPORTED_EXTENSIONS } from '../rag/parse';

export const documentsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
});

documentsRouter.get('/documents', (_req, res) => {
  res.json({ documents: listDocuments(), supported: SUPPORTED_EXTENSIONS });
});

/**
 * POST /api/documents/upload — multipart, field name `files` (or `file`).
 * Ingests each file and reports per-file status so one bad PDF does not fail
 * the whole batch.
 */
documentsRouter.post('/documents/upload', upload.any(), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) {
    return res.status(400).json({ error: 'No files uploaded (use the "files" field)' });
  }

  const results = [];
  for (const file of files) {
    // Browsers percent-encode non-ASCII filenames in multipart headers.
    const name = safeOriginalName(file.originalname);
    try {
      const { document, deduplicated, replaced } = await ingestDocument(name, file.buffer);
      results.push({ ok: true, document, deduplicated, replaced });
    } catch (err) {
      results.push({ ok: false, fileName: name, error: (err as Error).message });
    }
  }

  const anyOk = results.some((r) => r.ok);
  res.status(anyOk ? 200 : 400).json({ results, documents: listDocuments() });
});

/** POST /api/documents/attach — ingest a file already on disk, by path. */
documentsRouter.post('/documents/attach', async (req, res) => {
  const filePath = String(req.body?.path ?? '');
  if (!filePath) return res.status(400).json({ error: 'path is required' });
  try {
    const resolved = resolveInsideHome(filePath);
    const buffer = await fs.readFile(resolved);
    const result = await ingestDocument(path.basename(resolved), buffer);
    res.json({ ...result, documents: listDocuments() });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

documentsRouter.delete('/documents/:id', async (req, res) => {
  const removed = await deleteDocument(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Document not found' });
  res.json({ ok: true, documents: listDocuments() });
});

/**
 * GET /api/documents/events — SSE stream of indexing status changes, so the
 * overlay can animate queued → parsing → embedding → ready without polling.
 */
documentsRouter.get('/documents/events', (req, res) => {
  res.setHeader('content-type', 'text/event-stream');
  res.setHeader('cache-control', 'no-cache, no-transform');
  res.setHeader('connection', 'keep-alive');
  res.flushHeaders?.();

  const onChange = () => {
    res.write(`data: ${JSON.stringify({ documents: listDocuments() })}\n\n`);
  };
  documentEvents.on('change', onChange);

  const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
  ping.unref?.();

  req.on('close', () => {
    clearInterval(ping);
    documentEvents.off('change', onChange);
  });
});

/**
 * GET /api/files/browse?dir=... — powers the in-overlay file picker.
 *
 * A native OS file dialog is a separate window that screen-sharing captures
 * even when the overlay itself is capture-protected, so the picker is drawn
 * inside the overlay instead. Browsing is confined to the home directory.
 */
documentsRouter.get('/files/browse', async (req, res) => {
  const home = os.homedir();
  const requested = typeof req.query.dir === 'string' && req.query.dir ? req.query.dir : home;
  try {
    const dir = resolveInsideHome(requested);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const dirs = [];
    const files = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) {
        dirs.push({ name: entry.name, path: path.join(dir, entry.name) });
      } else if (entry.isFile() && isSupported(entry.name)) {
        const full = path.join(dir, entry.name);
        let bytes = 0;
        try {
          bytes = (await fs.stat(full)).size;
        } catch {
          /* vanished between readdir and stat */
        }
        files.push({ name: entry.name, path: full, bytes });
      }
    }
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    res.json({
      dir,
      parent: dir === home ? null : path.dirname(dir),
      home,
      dirs: dirs.sort(byName),
      files: files.sort(byName),
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

/** Keep path traversal (`../../etc/passwd`) inside the user's home dir. */
function resolveInsideHome(input: string): string {
  const home = os.homedir();
  const expanded = input.startsWith('~') ? path.join(home, input.slice(1)) : input;
  const resolved = path.resolve(expanded);
  if (resolved !== home && !resolved.startsWith(home + path.sep)) {
    throw new Error('Path is outside the home directory');
  }
  return resolved;
}

function safeOriginalName(name: string): string {
  try {
    // Multer hands back latin1-decoded bytes for UTF-8 filenames.
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
}
