/**
 * Compiles the macOS ScreenCaptureKit audio helper.
 *
 * Runs as a no-op on other platforms and never fails the build — the app
 * falls back to a virtual audio device when the helper is absent.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'native', 'macos', 'SystemAudioCapture.swift');
const outDir = path.join(root, 'native', 'bin');
const output = path.join(outDir, 'SystemAudioCapture');

if (process.platform !== 'darwin') {
  console.log('skip: macOS audio helper is only built on macOS');
  process.exit(0);
}

if (!existsSync(source)) {
  console.error(`skip: ${source} not found`);
  process.exit(0);
}

try {
  execFileSync('xcrun', ['--find', 'swiftc'], { stdio: 'ignore' });
} catch {
  console.error('skip: swiftc not found. Install Xcode command line tools:');
  console.error('      xcode-select --install');
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });

try {
  execFileSync(
    'swiftc',
    [
      '-O',
      '-o', output,
      source,
      '-framework', 'ScreenCaptureKit',
      '-framework', 'AVFoundation',
      '-framework', 'CoreMedia',
    ],
    { stdio: 'inherit' },
  );
  console.log(`built ${path.relative(root, output)}`);
  console.log('System audio will now be captured natively — no BlackHole needed.');
} catch (err) {
  console.error('macOS audio helper failed to build; falling back to a virtual audio device.');
  console.error(String(err.message).split('\n')[0]);
  process.exit(0);
}
