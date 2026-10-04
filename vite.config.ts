import { defineConfig, type Plugin } from 'vite';
import { VitePWA, type ManifestOptions } from 'vite-plugin-pwa';

const manifestBase: Partial<ManifestOptions> = {
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
};

const manifestRu: Partial<ManifestOptions> = {
  ...manifestBase,
  name: 'Фото в PDF',
  short_name: 'Фото в PDF',
  description: 'Раскладывает фото по страницам и собирает PDF прямо в браузере',
  lang: 'ru',
};

const manifestEn: Partial<ManifestOptions> = {
  ...manifestBase,
  name: 'Photo to PDF',
  short_name: 'Photo to PDF',
  description: 'Lays photos out across pages and builds a PDF right in the browser',
  lang: 'en',
};

// A manifest holds one language, so the English one is emitted as a second file;
// the page points its manifest link at the right one (see translatePage in src/i18n.ts)
const englishManifest = (): Plugin => ({
  name: 'english-manifest',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'manifest.en.webmanifest',
      source: JSON.stringify(manifestEn),
    });
  },
});

export default defineConfig({
  // relative paths so the build works from a subfolder (GitHub Pages)
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: manifestRu,
    }),
    englishManifest(),
  ],
});
