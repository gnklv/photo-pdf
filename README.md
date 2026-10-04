# Photo → PDF

A small web app: drop in your photos and get a PDF with them laid out evenly across pages.

Everything runs in the browser — your photos are never uploaded anywhere.

## Features

- Add photos by drag and drop or through the file picker
- Reorder by dragging thumbnails, remove individual photos
- Photos are split across pages evenly: 10 photos at 4 per page gives 4, 3, 3
- The grid on each page is chosen so the photos come out as large as possible
- Settings: page format (A4, A5, A3, Letter, 10×15 cm), orientation, photos per page, margins, gaps, fit whole or crop to fill
- Live page preview

## Getting started

```bash
npm install
npm run dev
```

To build for deployment, run `npm run build`; the output goes to `dist/`.

## Deployment

Every push to `master` builds the app and publishes it to GitHub Pages via the workflow in `.github/workflows/deploy.yml`. In the repository settings, set **Pages → Source** to **GitHub Actions**.

## How it works

- `index.html` — markup
- `src/main.js` — page layout, preview, PDF generation
- `src/style.css` — styles

The PDF is generated with [jsPDF](https://github.com/parallax/jsPDF); the build uses [Vite](https://vite.dev).

## Limitations

- HEIC files open only in Safari
- Photos are downscaled to 2400 px on the long side and stored as JPEG when written to the PDF
