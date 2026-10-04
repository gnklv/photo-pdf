import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // relative paths so the build works from a subfolder (GitHub Pages)
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Фото в PDF',
        short_name: 'Фото в PDF',
        description: 'Раскладывает фото по страницам и собирает PDF прямо в браузере',
        lang: 'ru',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        theme_color: '#2f6fed',
        background_color: '#f4f4f2',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
