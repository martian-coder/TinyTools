import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  define: {
    __BUILD_STAMP__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      base,
      manifest: {
        name: 'Perch — AI Guardian',
        short_name: 'Perch',
        description: 'The AI guardian that watches over your kid\'s phone — without reading over their shoulder',
        theme_color: '#0a120e',
        background_color: '#0a120e',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['lifestyle', 'utilities'],
        icons: [
          { src: './logo-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: './logo-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
