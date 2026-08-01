import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Matches the convention used by the other Pages surfaces in this repo: the
// deploy workflow sets VITE_BASE to the subpath, local dev falls back to root.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
