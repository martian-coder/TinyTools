import { Router } from 'express';
import {
  audioEvents,
  startAudioSession,
  status,
  stopAllAudio,
  stopAudioSession,
} from '../session/audioSession';
import { defaultSttProvider, STT_PROVIDERS, toSttProviderInfo } from '../stt/registry';
import type { AudioSource, SttProvidersResponse } from '../../shared/types';

/**
 * Set by the Electron main process when the ScreenCaptureKit helper is
 * available. The backend can run standalone, where it never is.
 */
let nativeHelperReady = false;
export function setNativeSystemAudio(available: boolean): void {
  nativeHelperReady = available;
}
function nativeSystemAudio(): boolean {
  return nativeHelperReady;
}

export const audioRouter = Router();

/**
 * How system audio can be captured, per OS. Electron's `loopback` option is
 * Windows-only, so the other platforms route through a device instead — the
 * overlay uses this to pick the right capture path and to explain itself.
 */
export function systemAudioSupport(
  platform: NodeJS.Platform = process.platform,
  nativeHelper = false,
) {
  switch (platform) {
    case 'win32':
      return {
        platform,
        method: 'loopback' as const,
        supported: true,
        hint: 'Captured directly via WASAPI loopback. No setup needed.',
      };
    case 'linux':
      return {
        platform,
        method: 'monitor-device' as const,
        supported: true,
        hint: 'Captured from a PulseAudio ".monitor" source. Pick one in the audio panel.',
      };
    case 'darwin':
      // With the helper built, ScreenCaptureKit captures system audio
      // directly and no virtual cable is needed.
      return nativeHelper
        ? {
            platform,
            method: 'screencapturekit' as const,
            supported: true,
            hint: 'Captured natively via ScreenCaptureKit. Needs Screen Recording permission.',
          }
        : {
            platform,
            method: 'virtual-device' as const,
            supported: true,
            hint:
              'Run "npm run build:macos-audio" for native capture, or install a ' +
              'virtual device (BlackHole), route your meeting app through it, and pick it here.',
          };
    default:
      return {
        platform,
        method: 'virtual-device' as const,
        supported: false,
        hint: 'System audio capture is not supported on this platform. Mic capture still works.',
      };
  }
}

/** GET /api/audio/providers — STT engines, availability, live status. */
audioRouter.get('/audio/providers', (_req, res) => {
  const body: SttProvidersResponse = {
    providers: STT_PROVIDERS.map(toSttProviderInfo),
    defaultProvider: defaultSttProvider(),
    status: status(),
    systemAudio: systemAudioSupport(process.platform, nativeSystemAudio()),
  };
  res.json(body);
});

audioRouter.get('/audio/status', (_req, res) => res.json(status()));

/** POST /api/audio/start — open a transcription session for one source. */
audioRouter.post('/audio/start', async (req, res) => {
  const source = req.body?.source as AudioSource;
  if (source !== 'mic' && source !== 'system') {
    return res.status(400).json({ error: 'source must be "mic" or "system"' });
  }
  try {
    const result = await startAudioSession({
      source,
      providerId: String(req.body?.provider ?? defaultSttProvider()),
      model: req.body?.model ? String(req.body.model) : undefined,
      language: req.body?.language ? String(req.body.language) : undefined,
      diarize: Boolean(req.body?.diarize),
      speakerLabel: req.body?.speakerLabel ? String(req.body.speakerLabel) : undefined,
    });
    res.json(result);
  } catch (err) {
    // A missing key or a refused connection is a normal outcome here, so it
    // comes back as a readable message rather than a 500.
    res.status(400).json({ error: (err as Error).message });
  }
});

audioRouter.post('/audio/stop', async (req, res) => {
  const source = req.body?.source as AudioSource | undefined;
  if (!source) {
    await stopAllAudio();
    return res.json(status());
  }
  res.json(await stopAudioSession(source));
});

/** GET /api/audio/events — SSE status stream, so the UI never polls. */
audioRouter.get('/audio/events', (req, res) => {
  res.setHeader('content-type', 'text/event-stream');
  res.setHeader('cache-control', 'no-cache, no-transform');
  res.setHeader('connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(`data: ${JSON.stringify(status())}\n\n`);

  const onStatus = (payload: unknown) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
  audioEvents.on('status', onStatus);

  const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
  ping.unref?.();

  req.on('close', () => {
    clearInterval(ping);
    audioEvents.off('status', onStatus);
  });
});
