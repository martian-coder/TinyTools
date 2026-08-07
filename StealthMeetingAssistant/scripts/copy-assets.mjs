import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// tsc only emits .ts; the overlay is plain HTML/CSS/JS, so copy it verbatim.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const from = path.join(root, 'src', 'overlay');
const to = path.join(root, 'dist', 'overlay');

await mkdir(to, { recursive: true });
await cp(from, to, { recursive: true });
console.log(`copied overlay assets -> ${path.relative(root, to)}`);
