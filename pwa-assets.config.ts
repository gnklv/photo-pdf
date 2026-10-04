import { defineConfig } from '@vite-pwa/assets-generator/config';

const background = '#2f6fed';

export default defineConfig({
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']], padding: 0 },
    // the artwork already sits inside the maskable safe zone, so no extra padding
    maskable: { sizes: [512], padding: 0, resizeOptions: { background } },
    apple: { sizes: [180], padding: 0, resizeOptions: { background } },
  },
  images: ['public/icon.svg'],
});
