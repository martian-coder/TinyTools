import { EventEmitter } from 'node:events';
import type { TranscriptEvent } from '../../shared/types';

const MAX_LINES = 400;

/**
 * Rolling in-memory transcript buffer. Deliberately not persisted — a meeting
 * transcript is the most sensitive thing this app touches, so it dies with
 * the process unless you explicitly export it.
 *
 * Interim (`isFinal: false`) lines from the same speaker replace each other,
 * which is how streaming STT engines (Deepgram, AssemblyAI, Whisper
 * streaming) emit partial results.
 */
class TranscriptBuffer extends EventEmitter {
  private lines: TranscriptEvent[] = [];

  append(event: Partial<TranscriptEvent>): TranscriptEvent | undefined {
    const text = String(event.text ?? '').trim();
    if (!text) return undefined;

    const entry: TranscriptEvent = {
      speaker: String(event.speaker ?? 'Unknown').slice(0, 60),
      text: text.slice(0, 4000),
      isFinal: event.isFinal !== false,
      timestamp: Number.isFinite(event.timestamp) ? Number(event.timestamp) : Date.now(),
    };

    const last = this.lines[this.lines.length - 1];
    if (last && !last.isFinal && last.speaker === entry.speaker) {
      this.lines[this.lines.length - 1] = entry;
    } else {
      this.lines.push(entry);
    }

    if (this.lines.length > MAX_LINES) {
      this.lines.splice(0, this.lines.length - MAX_LINES);
    }
    this.emit('append', entry);
    return entry;
  }

  /** Most recent `limit` lines, oldest first. */
  recent(limit = 40): TranscriptEvent[] {
    return this.lines.slice(-Math.max(1, limit));
  }

  /** Lines from the last `minutes`, for "summarize the last few minutes". */
  since(minutes: number): TranscriptEvent[] {
    const cutoff = Date.now() - minutes * 60_000;
    const window = this.lines.filter((l) => l.timestamp >= cutoff);
    // Never hand the model an empty window just because clocks disagree.
    return window.length ? window : this.recent(20);
  }

  all(): TranscriptEvent[] {
    return this.lines.slice();
  }

  count(): number {
    return this.lines.length;
  }

  clear(): void {
    this.lines = [];
    this.emit('clear');
  }
}

export const transcript = new TranscriptBuffer();
