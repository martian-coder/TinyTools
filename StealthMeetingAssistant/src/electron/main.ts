import path from 'node:path';
import {
  app,
  BrowserWindow,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  screen,
  session,
  shell,
  systemPreferences,
} from 'electron';
import {
  dataDir,
  ensureUserEnvFile,
  loadEnv,
  port as configuredPort,
  sessionToken,
} from '../server/config';
import { startServer, type RunningServer } from '../server/app';
import { setNativeSystemAudio } from '../server/routes/audio';
import {
  helperAvailable,
  startSystemAudioHelper,
  stopSystemAudioHelper,
} from './systemAudio';

const WIDTH = 420;
const HEIGHT = 520;
const MARGIN = 24;

let win: BrowserWindow | undefined;
let backend: RunningServer | undefined;
/** Click-through: pointer events pass to the meeting app underneath. */
let interactive = true;
let visible = true;

/** Single instance — a second launch just reveals the existing overlay. */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showOverlay());
}

function createWindow(url: string): BrowserWindow {
  const display = screen.getPrimaryDisplay().workArea;

  const overlay = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    x: display.x + display.width - WIDTH - MARGIN,
    y: display.y + MARGIN,
    minWidth: 320,
    minHeight: 260,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: true,
    movable: true,
    skipTaskbar: true,
    // Never take focus from Zoom/Teams when it appears.
    focusable: true,
    alwaysOnTop: true,
    fullscreenable: false,
    // macOS: no traffic lights, no title bar, but still draggable via CSS.
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: !app.isPackaged,
    },
  });

  /**
   * The whole point of the exercise: ask the OS to exclude this window from
   * screen capture. On macOS this maps to NSWindowSharingNone; on Windows to
   * SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE), which needs Win10 2004+.
   * On Linux/X11 there is no equivalent and the call is a no-op — see README.
   */
  overlay.setContentProtection(true);

  // 'screen-saver' keeps it above full-screen meeting windows.
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  overlay.loadURL(url);

  overlay.once('ready-to-show', () => {
    // showInactive, not show: the meeting app keeps keyboard focus.
    overlay.showInactive();
    visible = true;
  });

  // External links open in the real browser, never inside the overlay.
  overlay.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: 'deny' };
  });
  overlay.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith(url.split('?')[0].replace(/index\.html$/, ''))) {
      event.preventDefault();
    }
  });

  overlay.on('closed', () => {
    win = undefined;
  });

  return overlay;
}

function showOverlay(): void {
  if (!win) return;
  win.showInactive();
  win.setAlwaysOnTop(true, 'screen-saver');
  visible = true;
  send('visibility', { visible });
}

function hideOverlay(): void {
  if (!win) return;
  win.hide();
  visible = false;
  send('visibility', { visible });
}

/** Panic key. Hide is instant and unconditional. */
function toggleVisibility(): void {
  if (!win) return;
  if (visible && win.isVisible()) hideOverlay();
  else showOverlay();
}

function setInteractive(next: boolean): void {
  if (!win) return;
  interactive = next;
  // forward:true still lets the renderer see hover while ignoring clicks.
  win.setIgnoreMouseEvents(!interactive, { forward: true });
  send('interactive', { interactive });
}

function send(channel: string, payload: unknown): void {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

/** Route a hotkey to the renderer, revealing the overlay first if hidden. */
function dispatch(action: string): void {
  if (!win) return;
  if (!visible) showOverlay();
  if (!interactive) setInteractive(true);
  send('hotkey', { action });
}

function registerShortcuts(): void {
  const bindings: Record<string, () => void> = {
    'CommandOrControl+Shift+H': toggleVisibility,
    'CommandOrControl+Shift+I': () => setInteractive(!interactive),
    'CommandOrControl+Shift+M': () => dispatch('models'),
    'CommandOrControl+Shift+D': () => dispatch('documents'),
    'CommandOrControl+Shift+P': () => dispatch('pause'),
    'CommandOrControl+Shift+S': () => dispatch('summarize'),
    'CommandOrControl+Shift+A': () => dispatch('action-items'),
    'CommandOrControl+Shift+R': () => dispatch('retrieve'),
    // Start/stop listening without touching the overlay — the one hotkey you
    // want when a meeting starts unexpectedly.
    'CommandOrControl+Shift+L': () => dispatch('listen'),
    'CommandOrControl+Shift+K': () => dispatch('meeting'),
  };

  for (const [accelerator, handler] of Object.entries(bindings)) {
    // Another app may already own the combo; log rather than crash.
    if (!globalShortcut.register(accelerator, handler)) {
      console.warn(`[hotkeys] Could not register ${accelerator} — already taken?`);
    }
  }
}

/**
 * Wire up audio capture permissions and the system-audio path.
 *
 * `audio: 'loopback'` is Windows-only in Electron; macOS and Linux capture
 * system audio through an input device instead (BlackHole, a PulseAudio
 * .monitor source), which needs nothing here.
 */
function configureMediaAccess(): void {
  const current = session.defaultSession;

  current.setDisplayMediaRequestHandler(
    (_request, callback) => {
      desktopCapturer
        .getSources({ types: ['screen'], fetchWindowIcons: false })
        .then((sources) => {
          if (!sources.length) return callback({ video: undefined });
          // The video track is required to obtain the stream and is dropped by
          // the renderer immediately — only the loopback audio is wanted.
          callback({
            video: sources[0],
            audio: process.platform === 'win32' ? 'loopback' : undefined,
          });
        })
        .catch(() => callback({ video: undefined }));
    },
    // Suppresses the "app is sharing your screen" system overlay, which would
    // otherwise appear on screen — and in the share — the moment we capture.
    { useSystemPicker: false },
  );

  // The overlay is local and trusted; anything else is denied.
  current.setPermissionRequestHandler((contents, permission, callback) => {
    // 'media' covers microphone; 'display-capture' is the loopback path.
    const allowed = permission === 'media' || permission === 'display-capture';
    callback(allowed && contents === win?.webContents);
  });
  // The synchronous check only ever sees 'media' for audio capture.
  current.setPermissionCheckHandler((_contents, permission) => permission === 'media');
}

/** macOS gates the microphone behind an explicit, one-time consent prompt. */
async function ensureMicrophoneAccess(): Promise<boolean> {
  if (process.platform !== 'darwin') return true;
  const state = systemPreferences.getMediaAccessStatus('microphone');
  if (state === 'granted') return true;
  if (state === 'denied') return false;
  try {
    return await systemPreferences.askForMediaAccess('microphone');
  } catch {
    return false;
  }
}

async function bootstrap(): Promise<void> {
  // An installed app's own directory is read-only, so documents, embeddings,
  // the session token and the user's .env all live under userData instead.
  if (app.isPackaged && !process.env.DATA_DIR) {
    process.env.DATA_DIR = app.getPath('userData');
  }
  if (app.isPackaged) {
    // First run gets a real .env to edit rather than a missing-key error.
    ensureUserEnvFile(path.join(process.resourcesPath, '.env.example'));
  }
  loadEnv();
  console.log(`[assistant] data directory: ${dataDir()}`);
  configureMediaAccess();
  setNativeSystemAudio(helperAvailable());

  // `npm run dev` runs the backend in a separate watched process.
  const external = process.env.ASSISTANT_EXTERNAL_SERVER === '1';
  let baseUrl: string;

  if (external) {
    baseUrl = `http://127.0.0.1:${configuredPort()}`;
  } else {
    // Port 0 = let the OS pick, so we never collide with a stale process.
    backend = await startServer(0);
    baseUrl = backend.url;
  }

  const token = sessionToken();
  const url = `${baseUrl}/index.html?token=${encodeURIComponent(token)}`;

  win = createWindow(url);
  registerShortcuts();
  setInteractive(true);
}

app.whenReady().then(() => {
  // macOS: keep the overlay out of the Dock and the app switcher.
  if (process.platform === 'darwin') app.dock?.hide();

  bootstrap().catch((err) => {
    console.error('Failed to start overlay:', err);
    app.quit();
  });

  app.on('activate', () => {
    if (!BrowserWindow.getAllWindows().length) bootstrap();
  });
});

ipcMain.handle('overlay:config', () => ({
  token: sessionToken(),
  baseUrl: backend?.url ?? `http://127.0.0.1:${configuredPort()}`,
  platform: process.platform,
  // Windows and macOS honour setContentProtection; X11 does not.
  contentProtectionSupported: process.platform === 'darwin' || process.platform === 'win32',
  // True when the ScreenCaptureKit helper is built, which removes the
  // BlackHole requirement for macOS system audio.
  nativeSystemAudio: helperAvailable(),
  interactive,
}));

ipcMain.handle('overlay:mic-access', () => ensureMicrophoneAccess());

/**
 * Grab the screen for visual context — the shared deck, spreadsheet or diagram
 * the meeting is actually about.
 *
 * The overlay itself is excluded wherever content protection works, so the
 * model never sees its own previous answer reflected back. Downscaled to
 * 1280px because a full 4K frame costs a great many tokens for no extra
 * legibility.
 */
ipcMain.handle('overlay:capture-screen', async () => {
  try {
    const { width, height } = screen.getPrimaryDisplay().size;
    const scale = Math.min(1, 1280 / Math.max(width, height));
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: Math.round(width * scale), height: Math.round(height * scale) },
      fetchWindowIcons: false,
    });
    const thumbnail = sources[0]?.thumbnail;
    if (!thumbnail || thumbnail.isEmpty()) {
      return { ok: false, error: 'No screen available to capture' };
    }
    return {
      ok: true,
      mediaType: 'image/jpeg' as const,
      data: thumbnail.toJPEG(70).toString('base64'),
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
});

// macOS native system audio: the helper writes PCM straight into the backend,
// so the renderer only starts and stops it.
ipcMain.handle('overlay:system-audio-start', () => startSystemAudioHelper());
ipcMain.handle('overlay:system-audio-stop', () => {
  stopSystemAudioHelper();
  return { ok: true };
});
ipcMain.handle('overlay:hide', () => hideOverlay());
ipcMain.handle('overlay:set-interactive', (_e, next: boolean) => setInteractive(Boolean(next)));
ipcMain.handle('overlay:quit', () => app.quit());

/** Opens the folder holding .env, documents and embeddings. */
ipcMain.handle('overlay:open-data-dir', () => {
  const dir = process.env.DATA_DIR ?? app.getPath('userData');
  shell.openPath(dir);
  return dir;
});

/** The UI grows for the document panel and shrinks back afterwards. */
ipcMain.handle('overlay:resize', (_e, payload: { height?: number }) => {
  if (!win) return;
  const height = Math.max(260, Math.min(900, Math.round(payload?.height ?? HEIGHT)));
  const [w] = win.getSize();
  win.setSize(w, height, false);
});

app.on('will-quit', () => {
  stopSystemAudioHelper();
  globalShortcut.unregisterAll();
  backend?.close().catch(() => undefined);
});

// The overlay is the app; closing it should not leave a headless process.
app.on('window-all-closed', () => app.quit());
