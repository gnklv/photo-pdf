import { jsPDF } from 'jspdf';
import { getLang, setLang, t, translatePage, type Lang } from './i18n';
import './style.css';

type Fit = 'contain' | 'cover';

interface Photo {
  id: number;
  url: string;
  w: number;
  h: number;
}

interface Settings {
  w: number;
  h: number;
  margin: number;
  gap: number;
  perPage: number;
  fit: Fit;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Placement extends Rect {
  photo: Photo;
  cell: Rect;
}

interface Grid {
  score: number;
  cols: number;
  rows: number;
  cw: number;
  ch: number;
}

function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

const MAX_SIDE = 2400; // max pixels on the long side when written to the PDF
let photos: Photo[] = [];
let nextId = 1;

function settings(): Settings {
  const value = (id: string) => $<HTMLInputElement | HTMLSelectElement>(id).value;
  let [w, h] = value('format').split('x').map(Number);
  if (value('orient') === 'l') [w, h] = [h, w];
  const num = (id: string, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, Number(value(id)) || 0));
  const gap = num('gap', 0, 50);
  const margin = Math.min(num('margin', 0, 50), Math.min(w, h) / 2 - 5);
  return {
    w, h, margin, gap,
    perPage: Math.round(num('perPage', 1, 30)),
    fit: value('fit') === 'cover' ? 'cover' : 'contain',
  };
}

// Splits photos across pages evenly: 10 photos at 4 per page → 4, 3, 3 (not 4, 4, 2)
function paginate(list: Photo[], perPage: number): Photo[][] {
  const pages = Math.ceil(list.length / perPage);
  const base = Math.floor(list.length / pages), extra = list.length % pages;
  const out: Photo[][] = [];
  for (let i = 0, at = 0; i < pages; i++) {
    const n = base + (i < extra ? 1 : 0);
    out.push(list.slice(at, at + n));
    at += n;
  }
  return out;
}

// Picks the grid where the photos cover the largest area
// and returns their rectangles in mm
function layoutPage(items: Photo[], s: Settings): Placement[] {
  const W = s.w - 2 * s.margin, H = s.h - 2 * s.margin;
  let best: Grid | null = null;
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
  if (!best) return [];
  const { cols, rows, cw, ch } = best;
  return items.map((photo, i) => {
    const row = Math.floor(i / cols), col = i % cols;
    const inRow = row === rows - 1 ? items.length - row * cols : cols;
    const rowW = inRow * cw + (inRow - 1) * s.gap;
    const cx = s.margin + (W - rowW) / 2 + col * (cw + s.gap);
    const cy = s.margin + row * (ch + s.gap);
    const cell: Rect = { x: cx, y: cy, w: cw, h: ch };
    if (s.fit === 'cover') return { photo, ...cell, cell };
    const k = Math.min(cw / photo.w, ch / photo.h);
    const w = photo.w * k, h = photo.h * k;
    return { photo, x: cx + (cw - w) / 2, y: cy + (ch - h) / 2, w, h, cell };
  });
}

function render(): void {
  const s = settings();
  $('count').textContent = photos.length
    ? t('count', { n: photos.length, pages: Math.ceil(photos.length / s.perPage) })
    : t('noPhotos');
  $('clear').hidden = !photos.length;
  $('hint').hidden = photos.length < 2;
  $<HTMLButtonElement>('make').disabled = !photos.length;

  thumbs.innerHTML = '';
  for (const p of photos) {
    const el = document.createElement('div');
    el.className = 'thumb';
    el.dataset.id = String(p.id);
    el.innerHTML = `<img src="${p.url}" alt=""><button class="rm" title="${t('remove')}">×</button>`;
    thumbs.append(el);
  }
  renderPreview(s);
}

function renderPreview(s: Settings = settings()): void {
  const root = $('preview');
  root.innerHTML = '';
  if (!photos.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = t('empty');
    root.append(empty);
    return;
  }
  paginate(photos, s.perPage).forEach((items, i) => {
    const page = document.createElement('div');
    page.className = 'page';
    page.style.aspectRatio = `${s.w} / ${s.h}`;
    for (const r of layoutPage(items, s)) {
      const img = document.createElement('img');
      img.src = r.photo.url;
      img.alt = '';
      img.draggable = false;
      img.dataset.id = String(r.photo.id);
      img.style.cssText = `left:${r.x / s.w * 100}%;top:${r.y / s.h * 100}%;` +
        `width:${r.w / s.w * 100}%;height:${r.h / s.h * 100}%;object-fit:${s.fit}`;
      page.append(img);
    }
    const num = document.createElement('div');
    num.className = 'num';
    num.textContent = String(i + 1);
    page.append(num);
    root.append(page);
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

async function addFiles(files: File[]): Promise<void> {
  const skipped: string[] = [];
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
  if (skipped.length) alert(t('cantOpen') + '\n' + skipped.join('\n'));
}

// Redraws the photo as a JPEG of the needed size; for cover, crops it to the cell aspect ratio
async function toJpeg(photo: Photo, rect: Rect, fit: Fit): Promise<string> {
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
  if (!ctx) throw new Error('Canvas 2D context is unavailable');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.9);
}

async function makePdf(): Promise<void> {
  const s = settings();
  const btn = $<HTMLButtonElement>('make');
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
        btn.textContent = t('preparing', { done: ++done, total: photos.length });
      }
    }
    doc.save('photos.pdf');
  } catch (e) {
    console.error(e);
    alert(t('pdfFailed') + ' ' + (e instanceof Error ? e.message : String(e)));
  } finally {
    btn.textContent = t('download');
    btn.disabled = !photos.length;
  }
}

// --- events ---
const thumbs = $('thumbs');
const fileInput = $<HTMLInputElement>('file');

$('drop').onclick = () => fileInput.click();
fileInput.onchange = () => {
  addFiles([...(fileInput.files ?? [])]);
  fileInput.value = '';
};
$('make').onclick = makePdf;
$('clear').onclick = () => {
  photos.forEach(p => URL.revokeObjectURL(p.url));
  photos = [];
  render();
};
for (const id of ['format', 'orient', 'perPage', 'margin', 'gap', 'fit']) $(id).oninput = render;

function applyLang(): void {
  translatePage();
  render();
}
for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
  btn.onclick = () => {
    if (btn.dataset.lang === getLang()) return;
    setLang(btn.dataset.lang as Lang);
    applyLang();
  };
}

const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');
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
  addFiles([...(e.dataTransfer?.files ?? [])]);
});

const photoOf = (target: EventTarget | null) =>
  target instanceof Element ? target.closest<HTMLElement>('[data-id]') : null;

thumbs.onclick = e => {
  if (!(e.target instanceof Element) || !e.target.classList.contains('rm')) return;
  const id = Number(photoOf(e.target)?.dataset.id);
  const p = photos.find(p => p.id === id);
  if (!p) return;
  URL.revokeObjectURL(p.url);
  photos = photos.filter(p => p.id !== id);
  render();
};

// --- drag to reorder ---
// Works the same on thumbnails and on photos in the page preview. A mouse starts dragging
// after a small move; a finger has to hold first, so that swiping still scrolls the page.
// The order changes once, on drop: reflowing pages mid-drag would make targets jump around.
interface Drag {
  id: number;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
  timer: number;
  ghost: HTMLElement | null;
  targetId: number | null;
}

const LONG_PRESS_MS = 300;
const MOUSE_SLOP = 4;   // px a mouse must travel before a click turns into a drag
const TOUCH_SLOP = 10;  // px a finger may wander while holding
const EDGE = 70;        // px from the top/bottom of the viewport where dragging scrolls the page
let drag: Drag | null = null;

const elementsOf = (id: number | null) =>
  id === null ? [] : [...document.querySelectorAll<HTMLElement>(`[data-id="${id}"]`)];

function startDrag(): void {
  if (!drag || drag.active) return;
  const photo = photos.find(p => p.id === drag!.id);
  if (!photo) { endDrag(false); return; }
  clearTimeout(drag.timer);
  drag.active = true;

  const size = 110, k = size / Math.max(photo.w, photo.h);
  const ghost = document.createElement('img');
  ghost.className = 'drag-ghost';
  ghost.src = photo.url;
  ghost.alt = '';
  ghost.style.width = `${photo.w * k}px`;
  ghost.style.height = `${photo.h * k}px`;
  document.body.append(ghost);
  drag.ghost = ghost;

  elementsOf(drag.id).forEach(el => el.classList.add('moving'));
  document.body.classList.add('reordering');
  navigator.vibrate?.(10);
  getSelection()?.removeAllRanges();
  updateDrag();
  requestAnimationFrame(autoScroll);
}

function updateDrag(): void {
  if (!drag?.active || !drag.ghost) return;
  drag.ghost.style.transform = `translate(${drag.x}px, ${drag.y}px) translate(-50%, -50%)`;

  let targetId: number | null = Number(photoOf(document.elementFromPoint(drag.x, drag.y))?.dataset.id ?? NaN);
  if (Number.isNaN(targetId) || targetId === drag.id) targetId = null;
  if (targetId === drag.targetId) return;

  elementsOf(drag.targetId).forEach(el => el.classList.remove('drop-before', 'drop-after'));
  drag.targetId = targetId;
  // the bar shows which side of the target the photo will land on
  const from = photos.findIndex(p => p.id === drag!.id);
  const to = photos.findIndex(p => p.id === targetId);
  elementsOf(targetId).forEach(el => el.classList.add(from < to ? 'drop-after' : 'drop-before'));
}

function autoScroll(): void {
  if (!drag?.active) return;
  const speed = drag.y < EDGE ? drag.y - EDGE : drag.y > innerHeight - EDGE ? drag.y - (innerHeight - EDGE) : 0;
  if (speed) {
    scrollBy(0, speed / 4);
    updateDrag();
  }
  requestAnimationFrame(autoScroll);
}

function endDrag(commit: boolean): void {
  if (!drag) return;
  const { id, targetId, active, ghost, timer } = drag;
  drag = null;
  clearTimeout(timer);
  if (!active) return;
  ghost?.remove();
  document.body.classList.remove('reordering');
  elementsOf(id).forEach(el => el.classList.remove('moving'));
  elementsOf(targetId).forEach(el => el.classList.remove('drop-before', 'drop-after'));

  const from = photos.findIndex(p => p.id === id);
  const to = photos.findIndex(p => p.id === targetId);
  if (!commit || from < 0 || to < 0) return;
  photos.splice(to, 0, photos.splice(from, 1)[0]);
  render();
}

addEventListener('pointerdown', e => {
  if (drag || !e.isPrimary || e.button !== 0) return;
  const el = photoOf(e.target);
  if (!el || (e.target as Element).closest('.rm')) return;
  drag = {
    id: Number(el.dataset.id), pointerId: e.pointerId,
    startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY,
    active: false, ghost: null, targetId: null,
    timer: e.pointerType === 'mouse' ? 0 : window.setTimeout(startDrag, LONG_PRESS_MS),
  };
});
addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.pointerId) return;
  drag.x = e.clientX;
  drag.y = e.clientY;
  if (!drag.active) {
    const moved = Math.hypot(drag.x - drag.startX, drag.y - drag.startY);
    if (e.pointerType === 'mouse') {
      if (moved > MOUSE_SLOP) startDrag();
    } else if (moved > TOUCH_SLOP) {
      endDrag(false); // the finger is scrolling, not holding
    }
    return;
  }
  updateDrag();
});
addEventListener('pointerup', e => { if (e.pointerId === drag?.pointerId) endDrag(true); });
addEventListener('pointercancel', e => { if (e.pointerId === drag?.pointerId) endDrag(false); });
addEventListener('keydown', e => { if (e.key === 'Escape') endDrag(false); });

// keep the browser from scrolling, opening the image menu or starting its own drag meanwhile
document.addEventListener('touchmove', e => { if (drag?.active) e.preventDefault(); }, { passive: false });
addEventListener('contextmenu', e => { if (drag || (e.target instanceof HTMLImageElement && photoOf(e.target))) e.preventDefault(); });
addEventListener('dragstart', e => { if (photoOf(e.target)) e.preventDefault(); });
document.addEventListener('selectstart', e => { if (drag) e.preventDefault(); });

applyLang();
