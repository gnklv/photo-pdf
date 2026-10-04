const ru = {
  title: 'Фото в PDF',
  description: 'Раскладывает фото по страницам и собирает PDF прямо в браузере',
  heading: 'Фото → PDF',
  language: 'Язык',
  dropMouse: 'Перетащите фото сюда\nили нажмите, чтобы выбрать',
  dropTouch: 'Нажмите, чтобы выбрать фото',
  format: 'Формат',
  size10x15: '10×15 см',
  orientation: 'Ориентация',
  portrait: 'Книжная',
  landscape: 'Альбомная',
  perPage: 'Фото на странице',
  margin: 'Поля, мм',
  gap: 'Отступ между фото, мм',
  fit: 'Вписывание',
  fitContain: 'Целиком, без обрезки',
  fitCover: 'Заполнить ячейку (с обрезкой)',
  noPhotos: 'Нет фото',
  count: 'Фото: {n}, страниц: {pages}',
  clear: 'Очистить',
  remove: 'Убрать',
  download: 'Скачать PDF',
  preparing: 'Готовлю… {done} / {total}',
  empty: 'Добавьте фото — здесь появится предпросмотр страниц',
  cantOpen: 'Браузер не смог открыть:',
  pdfFailed: 'Не получилось собрать PDF:',
};

export type Key = keyof typeof ru;

const en: Record<Key, string> = {
  title: 'Photo to PDF',
  description: 'Lays photos out across pages and builds a PDF right in the browser',
  heading: 'Photo → PDF',
  language: 'Language',
  dropMouse: 'Drop photos here\nor click to choose',
  dropTouch: 'Tap to choose photos',
  format: 'Format',
  size10x15: '10×15 cm',
  orientation: 'Orientation',
  portrait: 'Portrait',
  landscape: 'Landscape',
  perPage: 'Photos per page',
  margin: 'Margins, mm',
  gap: 'Gap between photos, mm',
  fit: 'Fit',
  fitContain: 'Whole photo, no cropping',
  fitCover: 'Fill the cell (cropped)',
  noPhotos: 'No photos',
  count: 'Photos: {n}, pages: {pages}',
  clear: 'Clear',
  remove: 'Remove',
  download: 'Download PDF',
  preparing: 'Preparing… {done} / {total}',
  empty: 'Add photos — the page preview will appear here',
  cantOpen: 'The browser could not open:',
  pdfFailed: 'Could not build the PDF:',
};

const dictionaries = { ru, en };

export type Lang = keyof typeof dictionaries;

const STORAGE_KEY = 'lang';
const isLang = (v: unknown): v is Lang => v === 'ru' || v === 'en';

// Saved choice first, then the browser language; anything but Russian falls back to English
function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    // storage can be blocked, e.g. in private mode
  }
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

let lang: Lang = detect();

export const getLang = (): Lang => lang;

export function setLang(next: Lang): void {
  lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // the choice just won't survive a reload
  }
}

export function t(key: Key, vars: Record<string, string | number> = {}): string {
  return dictionaries[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
}

// Fills in everything marked with data-i18n in the markup, plus the document metadata
export function translatePage(): void {
  document.documentElement.lang = lang;
  document.title = t('title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('description'));
  // the installed app takes its name from the manifest, and each manifest holds one language
  document.querySelector('link[rel="manifest"]')
    ?.setAttribute('href', lang === 'ru' ? 'manifest.webmanifest' : 'manifest.en.webmanifest');
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n as Key);
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-label]')) {
    el.setAttribute('aria-label', t(el.dataset.i18nLabel as Key));
  }
  for (const el of document.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
    el.setAttribute('aria-pressed', String(el.dataset.lang === lang));
  }
}
