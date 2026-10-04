import { jsPDF } from 'jspdf';
import './style.css';

const $ = id => document.getElementById(id);
const MAX_SIDE = 2400; // max pixels on the long side when written to the PDF
let photos = [];       // { id, url, w, h }
let nextId = 1;

function settings() {
  let [w, h] = $('format').value.split('x').map(Number);
  if ($('orient').value === 'l') [w, h] = [h, w];
  const num = (id, lo, hi) => Math.min(hi, Math.max(lo, Number($(id).value) || 0));
  const gap = num('gap', 0, 50);
  const margin = Math.min(num('margin', 0, 50), Math.min(w, h) / 2 - 5);
  return { w, h, margin, gap, perPage: Math.round(num('perPage', 1, 30)), fit: $('fit').value };
}

// Splits photos across pages evenly: 10 photos at 4 per page → 4, 3, 3 (not 4, 4, 2)
function paginate(list, perPage) {
  const pages = Math.ceil(list.length / perPage);
  const base = Math.floor(list.length / pages), extra = list.length % pages;
  const out = [];
  for (let i = 0, at = 0; i < pages; i++) {
    const n = base + (i < extra ? 1 : 0);
    out.push(list.slice(at, at + n));
    at += n;
  }
  return out;
}

// Picks the grid where the photos cover the largest area
// and returns rectangles in mm: { photo, x, y, w, h, cell }
function layoutPage(items, s) {
  const W = s.w - 2 * s.margin, H = s.h - 2 * s.margin;
  let best = null;
  for (let cols = 1; cols <= items.length; cols++) {
    const rows = Math.ceil(items.length / cols);
    const cw = (W - s.gap * (cols - 1)) / cols;
    const ch = (H - s.gap * (rows - 1)) / rows;
    if (cw <= 0 || ch <= 0) continue;
    let score = 0;
    for (const p of items) {
      const k = Math.min(cw / p.w, ch / p.h);
      score += p.w * p.h * k * k;
    }
    // on equal area, prefer fewer empty cells
    score -= (cols * rows - items.length) * 1e-6;
    if (!best || score > best.score) best = { score, cols, rows, cw, ch };
  }
  const { cols, rows, cw, ch } = best;
  return items.map((photo, i) => {
    const row = Math.floor(i / cols), col = i % cols;
    const inRow = row === rows - 1 ? items.length - row * cols : cols;
    const rowW = inRow * cw + (inRow - 1) * s.gap;
    const cx = s.margin + (W - rowW) / 2 + col * (cw + s.gap);
    const cy = s.margin + row * (ch + s.gap);
    const cell = { x: cx, y: cy, w: cw, h: ch };
    if (s.fit === 'cover') return { photo, ...cell, cell };
    const k = Math.min(cw / photo.w, ch / photo.h);
    const w = photo.w * k, h = photo.h * k;
    return { photo, x: cx + (cw - w) / 2, y: cy + (ch - h) / 2, w, h, cell };
  });
}

function render() {
  const s = settings();
  $('count').textContent = photos.length
    ? `Фото: ${photos.length}, страниц: ${Math.ceil(photos.length / s.perPage)}`
    : 'Нет фото';
  $('clear').hidden = !photos.length;
  $('make').disabled = !photos.length;

  const thumbs = $('thumbs');
  thumbs.innerHTML = '';
  for (const p of photos) {
    const el = document.createElement('div');
    el.className = 'thumb';
    el.draggable = true;
    el.dataset.id = p.id;
    el.innerHTML = `<img src="${p.url}" alt=""><button class="rm" title="Убрать">×</button>`;
    thumbs.append(el);
  }
  renderPreview(s);
}

function renderPreview(s = settings()) {
  const root = $('preview');
  root.innerHTML = '';
  if (!photos.length) {
    root.innerHTML = '<div class="empty">Добавьте фото — здесь появится предпросмотр страниц</div>';
    return;
  }
  paginate(photos, s.perPage).forEach((items, i) => {
    const page = document.createElement('div');
    page.className = 'page';
    page.style.aspectRatio = `${s.w} / ${s.h}`;
    for (const r of layoutPage(items, s)) {
      const img = document.createElement('img');
      img.src = r.photo.url;
      img.style.cssText = `left:${r.x / s.w * 100}%;top:${r.y / s.h * 100}%;` +
        `width:${r.w / s.w * 100}%;height:${r.h / s.h * 100}%;object-fit:${s.fit}`;
      page.append(img);
    }
    const num = document.createElement('div');
    num.className = 'num';
    num.textContent = i + 1;
    page.append(num);
    root.append(page);
  });
}

function loadImage(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

async function addFiles(files) {
  const skipped = [];
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    const url = URL.createObjectURL(f);
    try {
      const img = await loadImage(url);
      photos.push({ id: nextId++, url, w: img.naturalWidth, h: img.naturalHeight });
    } catch {
      URL.revokeObjectURL(url);
      skipped.push(f.name);
    }
  }
  render();
  if (skipped.length) alert('Браузер не смог открыть:\n' + skipped.join('\n'));
}

// Redraws the photo as a JPEG of the needed size; for cover, crops it to the cell aspect ratio
async function toJpeg(photo, rect, fit) {
  const img = await loadImage(photo.url);
  let sx = 0, sy = 0, sw = photo.w, sh = photo.h;
  if (fit === 'cover') {
    const ratio = rect.w / rect.h;
    if (sw / sh > ratio) { sw = sh * ratio; sx = (photo.w - sw) / 2; }
    else { sh = sw / ratio; sy = (photo.h - sh) / 2; }
  }
  const k = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.round(sw * k);
  c.height = Math.round(sh * k);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.9);
}

async function makePdf() {
  const s = settings();
  const btn = $('make');
  btn.disabled = true;
  try {
    const doc = new jsPDF({
      unit: 'mm', format: [s.w, s.h], orientation: s.w > s.h ? 'landscape' : 'portrait',
    });
    const pages = paginate(photos, s.perPage);
    let done = 0;
    for (let i = 0; i < pages.length; i++) {
      if (i) doc.addPage();
      for (const r of layoutPage(pages[i], s)) {
        doc.addImage(await toJpeg(r.photo, r, s.fit), 'JPEG', r.x, r.y, r.w, r.h);
        btn.textContent = `Готовлю… ${++done} / ${photos.length}`;
      }
    }
    doc.save('photos.pdf');
  } catch (e) {
    console.error(e);
    alert('Не получилось собрать PDF: ' + e.message);
  } finally {
    btn.textContent = 'Скачать PDF';
    btn.disabled = !photos.length;
  }
}

// --- events ---
$('drop').onclick = () => $('file').click();
$('file').onchange = e => { addFiles([...e.target.files]); e.target.value = ''; };
$('make').onclick = makePdf;
$('clear').onclick = () => {
  photos.forEach(p => URL.revokeObjectURL(p.url));
  photos = [];
  render();
};
for (const id of ['format', 'orient', 'perPage', 'margin', 'gap', 'fit']) $(id).oninput = render;

const hasFiles = e => [...e.dataTransfer.types].includes('Files');
addEventListener('dragover', e => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  document.body.classList.add('dragging');
});
addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('dragging'); });
addEventListener('drop', e => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  document.body.classList.remove('dragging');
  addFiles([...e.dataTransfer.files]);
});

// removing thumbnails and dragging them to reorder
const thumbs = $('thumbs');
let movingId = null;
thumbs.onclick = e => {
  if (!e.target.classList.contains('rm')) return;
  const id = Number(e.target.parentElement.dataset.id);
  const p = photos.find(p => p.id === id);
  URL.revokeObjectURL(p.url);
  photos = photos.filter(p => p.id !== id);
  render();
};
thumbs.ondragstart = e => {
  const el = e.target.closest('.thumb');
  if (!el) return;
  movingId = Number(el.dataset.id);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', '');
  requestAnimationFrame(() => el.classList.add('moving'));
};
thumbs.ondragover = e => {
  if (movingId === null) return;
  e.preventDefault();
  const over = e.target.closest('.thumb');
  if (!over || Number(over.dataset.id) === movingId) return;
  const from = photos.findIndex(p => p.id === movingId);
  const to = photos.findIndex(p => p.id === Number(over.dataset.id));
  photos.splice(to, 0, photos.splice(from, 1)[0]);
  const moving = thumbs.querySelector(`[data-id="${movingId}"]`);
  over[from < to ? 'after' : 'before'](moving);
};
thumbs.ondragend = () => {
  movingId = null;
  render();
};
