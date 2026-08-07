import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
import fs from 'node:fs';
import path from 'node:path';
import { projectRoot } from '../server/config';
import { writeAudio } from '../server/session/audioSession';

/**
 * macOS native system audio, via the ScreenCaptureKit helper in native/macos.
 *
 * Electron's `audio: 'loopback'` is Windows-only, and macOS has no loopback
 * device of its own — the usual workaround is asking the user to install
 * BlackHole and re-route their meeting app. ScreenCaptureKit removes that
 * whole setup step: the helper writes 16 kHz mono PCM to stdout and we pipe
 * it straight into the same STT session the renderer would have fed.
 */

/** stdin is ignored; the helper only ever writes. */
type Helper = ChildProcessByStdio<null, Readable, Readable>;

let helper: Helper | undefined;

export function helperPath(): string {
  return path.join(projectRoot(), 'native', 'bin', 'SystemAudioCapture');
}

/** Present and executable, i.e. `npm run build:macos-audio` has been run. */
export function helperAvailable(): boolean {
  if (process.platform !== 'darwin') return false;
  try {
    fs.accessSync(helperPath(), fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function isHelperRunning(): boolean {
  return Boolean(helper && !helper.killed && helper.exitCode === null);
}

export interface HelperResult {
  ok: boolean;
  error?: string;
}

/**
 * Spawn the helper and stream its stdout into the system audio session.
 * Resolves once the helper reports it is capturing, or with the reason it
 * could not start — most often that Screen Recording permission is off.
 */
export function startSystemAudioHelper(): Promise<HelperResult> {
  if (!helperAvailable()) {
    return Promise.resolve({
      ok: false,
      error: 'The macOS audio helper is not built. Run: npm run build:macos-audio',
    });
  }
  if (isHelperRunning()) return Promise.resolve({ ok: true });

  return new Promise((resolve) => {
    const child = spawn(helperPath(), [], { stdio: ['ignore', 'pipe', 'pipe'] });
    helper = child;

    let settled = false;
    const settle = (result: HelperResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    // The helper prints "ready" on stderr once ScreenCaptureKit is running.
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (!text) return;
      if (text.includes('ready')) {
        settle({ ok: true });
        return;
      }
      // Anything else on stderr is a failure worth showing verbatim.
      settle({ ok: false, error: friendlyHelperError(text) });
    });

    child.stdout.on('data', (chunk: Buffer) => {
      writeAudio('system', chunk);
    });

    child.on('error', (err) => {
      helper = undefined;
      settle({ ok: false, error: `Could not launch the audio helper: ${err.message}` });
    });

    child.on('exit', (code) => {
      helper = undefined;
      if (code && code !== 0) {
        settle({ ok: false, error: exitCodeMessage(code) });
      }
    });

    // Never hang the UI waiting on a helper that says nothing.
    setTimeout(() => settle({ ok: false, error: 'The audio helper did not start within 5s' }), 5000);
  });
}

export function stopSystemAudioHelper(): void {
  if (!helper) return;
  helper.stdout.removeAllListeners('data');
  helper.kill('SIGTERM');
  helper = undefined;
}

function exitCodeMessage(code: number): string {
  if (code === 3) return 'System audio capture needs macOS 13 or newer.';
  if (code === 4) {
    return 'Screen Recording permission is required for system audio. Grant it in System Settings › Privacy & Security › Screen Recording, then restart.';
  }
  return `The audio helper exited with code ${code}.`;
}

function friendlyHelperError(text: string): string {
  if (/declined|permission|not authorized|TCC/i.test(text)) {
    return 'Screen Recording permission was declined. Enable it in System Settings › Privacy & Security › Screen Recording.';
  }
  return text.split('\n')[0].slice(0, 200);
}
