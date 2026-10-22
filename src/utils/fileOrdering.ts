import type { FileSortMode, PdfFileEntry } from '../types/pdf';

const collator = new Intl.Collator(['th', 'en'], { numeric: true, sensitivity: 'base' });

export function sortFiles(files: PdfFileEntry[], mode: FileSortMode): PdfFileEntry[] {
  const sorted = [...files];
  const byName = (a: PdfFileEntry, b: PdfFileEntry) => collator.compare(a.name, b.name);
  switch (mode) {
    case 'name-asc':
      sorted.sort(byName);
      break;
    case 'name-desc':
      sorted.sort((a, b) => byName(b, a));
      break;
    case 'size-asc':
      sorted.sort((a, b) => a.size - b.size || byName(a, b));
      break;
    case 'size-desc':
      sorted.sort((a, b) => b.size - a.size || byName(a, b));
      break;
    case 'pages-asc':
      sorted.sort((a, b) => a.pageCount - b.pageCount || byName(a, b));
      break;
    case 'pages-desc':
      sorted.sort((a, b) => b.pageCount - a.pageCount || byName(a, b));
      break;
  }
  return sorted;
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length) return items;
  const target = Math.max(0, Math.min(items.length - 1, to));
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return next;
}

export const SORT_LABELS: Record<FileSortMode, string> = {
  'name-asc': 'ชื่อไฟล์ A–Z / ก–ฮ',
  'name-desc': 'ชื่อไฟล์ Z–A / ฮ–ก',
  'size-asc': 'ขนาดไฟล์ เล็ก → ใหญ่',
  'size-desc': 'ขนาดไฟล์ ใหญ่ → เล็ก',
  'pages-asc': 'จำนวนหน้า น้อย → มาก',
  'pages-desc': 'จำนวนหน้า มาก → น้อย',
};
