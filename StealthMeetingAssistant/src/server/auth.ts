import type { NextFunction, Request, Response } from 'express';
import { authEnabled, sessionToken } from './config';

/**
 * The backend binds to 127.0.0.1, but loopback is not a security boundary:
 * any local process, and any web page you have open, can send requests to it.
 * The shared token is what actually keeps your documents and transcript from
 * being readable by a random tab.
 */
export function requireToken(req: Request, res: Response, next: NextFunction): void {
  if (!authEnabled()) return next();

  const presented =
    (req.headers['x-assistant-token'] as string | undefined) ??
    (typeof req.query.token === 'string' ? req.query.token : undefined) ??
    bearer(req.headers.authorization);

  if (presented && safeEqual(presented, sessionToken())) return next();

  res.status(401).json({
    error: 'Unauthorized',
    hint: 'Send the token from data/session-token.txt as the x-assistant-token header.',
  });
}

function bearer(header: string | undefined): string | undefined {
  if (!header?.toLowerCase().startsWith('bearer ')) return undefined;
  return header.slice(7).trim();
}

/** Constant-time compare so the token cannot be guessed byte by byte. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Block cross-origin browser requests outright. A page on the internet cannot
 * read our responses thanks to CORS, but it *can* fire off POSTs; rejecting
 * unknown origins stops that.
 */
export function sameOriginOnly(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (!origin) return next(); // curl, the overlay's file:// page, local scripts
  try {
    const host = new URL(origin).hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return next();
  } catch {
    /* malformed Origin */
  }
  res.status(403).json({ error: 'Cross-origin requests are not allowed' });
}
