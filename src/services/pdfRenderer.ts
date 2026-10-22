import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { normalizeRotation } from '../utils/rotation';

// ใช้ Worker ของ pdf.js ที่ถูก bundle มากับโปรแกรม (ไม่โหลดจากอินเทอร์เน็ต)
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const documents = new Map<string, Promise<PDFDocumentProxy>>();
const imageCache = new Map<string, string>();
const MAX_CACHE = 400;
const MAX_CONCURRENT = 2;

let running = 0;
const queue: Array<() => void> = [];

async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  running += 1;
  try {
    return await task();
  } finally {
    running -= 1;
    queue.shift()?.();
  }
}

function assetUrl(path: string): string {
  return new URL(path, document.baseURI).href;
}

function getDocument(fileId: string, bytes: Uint8Array): Promise<PDFDocumentProxy> {
  let doc = documents.get(fileId);
  if (!doc) {
    // pdf.js ย้ายบัฟเฟอร์ไปยัง Worker จึงต้องส่งสำเนา เพื่อไม่ให้ข้อมูลที่ใช้รวมไฟล์เสียหาย
    doc = pdfjs.getDocument({
      data: bytes.slice(),
      isEvalSupported: false,
      cMapUrl: assetUrl('pdfjs/cmaps/'),
      cMapPacked: true,
      standardFontDataUrl: assetUrl('pdfjs/standard_fonts/'),
    }).promise;
    doc.catch(() => documents.delete(fileId));
    documents.set(fileId, doc);
  }
  return doc;
}

function remember(key: string, value: string) {
  if (imageCache.size >= MAX_CACHE) {
    const oldest = imageCache.keys().next().value;
    if (oldest !== undefined) imageCache.delete(oldest);
  }
  imageCache.set(key, value);
}

/**
 * เรนเดอร์หน้า PDF เป็นภาพ (Data URL) ที่ความกว้างที่กำหนด พร้อมมุมหมุนที่ผู้ใช้ตั้งไว้
 * ภาพที่ได้ใช้แสดงผลเท่านั้น – ไฟล์ผลลัพธ์ถูกสร้างจาก PDF ต้นฉบับโดยตรง
 */
export function renderPageImage(
  fileId: string,
  bytes: Uint8Array,
  pageIndex: number,
  extraRotation: number,
  targetWidth: number,
): Promise<string> {
  const key = `${fileId}:${pageIndex}:${normalizeRotation(extraRotation)}:${targetWidth}`;
  const cached = imageCache.get(key);
  if (cached) return Promise.resolve(cached);

  return withSlot(async () => {
    const hit = imageCache.get(key);
    if (hit) return hit;
    const doc = await getDocument(fileId, bytes);
    const page = await doc.getPage(pageIndex + 1);
    try {
      const rotation = normalizeRotation(page.rotate + extraRotation);
      const base = page.getViewport({ scale: 1, rotation });
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const scale = (targetWidth / base.width) * pixelRatio;
      const viewport = page.getViewport({ scale, rotation });

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas-unavailable');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;

      const url = canvas.toDataURL('image/jpeg', 0.85);
      canvas.width = 0;
      canvas.height = 0;
      remember(key, url);
      return url;
    } finally {
      page.cleanup();
    }
  });
}

/** ปล่อยหน่วยความจำของไฟล์ที่ถูกลบออกจากรายการ */
export async function releaseDocument(fileId: string): Promise<void> {
  for (const key of [...imageCache.keys()]) {
    if (key.startsWith(`${fileId}:`)) imageCache.delete(key);
  }
  const doc = documents.get(fileId);
  documents.delete(fileId);
  if (doc) {
    try {
      await (await doc).destroy();
    } catch {
      // เอกสารเปิดไม่สำเร็จตั้งแต่แรก ไม่ต้องทำอะไรเพิ่ม
    }
  }
}

/** ล้างข้อมูลชั่วคราวทั้งหมด (ใช้เมื่อกดเริ่มต้นใหม่) */
export async function releaseAllDocuments(): Promise<void> {
  await Promise.all([...documents.keys()].map((id) => releaseDocument(id)));
  imageCache.clear();
}
