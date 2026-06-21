import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      base,
      manifest: {
        name: 'Strenes — Smart Message Filter',
        short_name: 'Strenes',
        description: 'AI-filtered messaging — you control what reaches you',
        theme_color: '#0b1020',
        background_color: '#0b1020',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['productivity', 'communication'],
        icons: [
          { src: './icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: './icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
        screenshots: [
          { src: './screenshot-narrow.png', sizes: '540x720', form_factor: 'narrow', type: 'image/png' },
          { src: './screenshot-wide.png', sizes: '1280x720', form_factor: 'wide', type: 'image/png' },
        ],
        shortcuts: [
          {
            name: 'Open Chat',
            short_name: 'Chat',
            description: 'Start a new conversation',
            url: './',
            icons: [{ src: './icon-192.svg', sizes: '192x192', type: 'image/svg+xml' }],
          },
        ],
      },
    }),
  ],
})
