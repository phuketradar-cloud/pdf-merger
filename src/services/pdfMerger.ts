import { PDFDocument, type PDFPage, degrees } from 'pdf-lib';
import type { MergeItem, MergeOutput, MergeProgress, MergeSource, MergeStage } from '../types/pdf';
import { normalizeRotation } from '../utils/rotation';

export type MergeErrorCode =
  | 'no-pages'
  | 'missing-source'
  | 'invalid-page'
  | 'read-failed'
  | 'copy-failed'
  | 'save-failed'
  | 'empty-output'
  | 'verify-failed'
  | 'page-count-mismatch'
  | 'cancelled'
  | 'out-of-memory'
  | 'timeout'
  | 'worker-failed';

export class MergeError extends Error {
  readonly code: MergeErrorCode;
  readonly fileName?: string;

  constructor(code: MergeErrorCode, fileName?: string) {
    super(code);
    this.name = 'MergeError';
    this.code = code;
    this.fileName = fileName;
  }
}

export interface MergeOptions {
  signal?: AbortSignal;
  onProgress?: (progress: MergeProgress) => void;
}

function isMemoryError(error: unknown): boolean {
  return error instanceof RangeError || (error instanceof Error && /memory|allocation/i.test(error.message));
}

function wrapError(error: unknown, code: MergeErrorCode, fileName?: string): MergeError {
  if (error instanceof MergeError) return error;
  if (isMemoryError(error)) return new MergeError('out-of-memory', fileName);
  return new MergeError(code, fileName);
}

/**
 * Core Merge Engine – สร้าง PDF ใหม่จากหน้าที่กำหนด ตามลำดับใน items
 * - คัดลอกหน้าด้วย pdf-lib (รักษาขนาดหน้า เนื้อหาข้อความ และภาพ)
 * - บันทึกมุมหมุนลงใน /Rotate ของหน้าในไฟล์ผลลัพธ์จริง (มุมเดิม + มุมที่ผู้ใช้หมุนเพิ่ม)
 * - ตรวจสอบผลลัพธ์โดยเปิดอ่านกลับและนับจำนวนหน้าก่อนคืนค่า
 */
export async function mergePdf(
  sources: MergeSource[],
  items: MergeItem[],
  options: MergeOptions = {},
): Promise<MergeOutput> {
  const { signal, onProgress } = options;
  const total = items.length;
  const report = (stage: MergeStage, done: number) => onProgress?.({ stage, done, total });
  const ensureActive = () => {
    if (signal?.aborted) throw new MergeError('cancelled');
  };

  // 1–3: ตรวจสอบข้อมูลก่อนเริ่ม
  report('preparing', 0);
  if (total === 0) throw new MergeError('no-pages');

  const sourceMap = new Map(sources.map((s) => [s.fileId, s]));
  const fileOrder: string[] = [];
  const positionsByFile = new Map<string, number[]>();
  items.forEach((item, position) => {
    if (!sourceMap.has(item.fileId)) throw new MergeError('missing-source');
    let positions = positionsByFile.get(item.fileId);
    if (!positions) {
      positions = [];
      positionsByFile.set(item.fileId, positions);
      fileOrder.push(item.fileId);
    }
    positions.push(position);
  });

  // 4: สร้างเอกสารใหม่
  const output = await PDFDocument.create();
  output.setProducer('PDF Merger');
  output.setCreator('PDF Merger');

  // 5–6: อ่านไฟล์ต้นฉบับทีละไฟล์ แล้วคัดลอกเฉพาะหน้าที่ต้องการ
  // คัดลอกครั้งเดียวต่อไฟล์ เพื่อให้ฟอนต์/ภาพที่ใช้ร่วมกันถูกคัดลอกเพียงครั้งเดียว
  const copied = new Array<PDFPage | undefined>(total);
  let copiedCount = 0;
  for (const fileId of fileOrder) {
    ensureActive();
    const source = sourceMap.get(fileId)!;
    report('reading', copiedCount);

    let doc: PDFDocument;
    try {
      doc = await PDFDocument.load(source.bytes, { updateMetadata: false });
    } catch (error) {
      throw wrapError(error, 'read-failed', source.fileName);
    }

    const positions = positionsByFile.get(fileId)!;
    let pageCount: number;
    try {
      pageCount = doc.getPageCount();
    } catch (error) {
      throw wrapError(error, 'read-failed', source.fileName);
    }
    const indices = positions.map((p) => items[p].sourceIndex);
    if (indices.some((i) => !Number.isInteger(i) || i < 0 || i >= pageCount)) {
      throw new MergeError('invalid-page', source.fileName);
    }

    ensureActive();
    report('copying', copiedCount);
    let pages: PDFPage[];
    try {
      pages = await output.copyPages(doc, indices);
    } catch (error) {
      throw wrapError(error, 'copy-failed', source.fileName);
    }
    pages.forEach((page, i) => {
      copied[positions[i]] = page;
    });
    copiedCount += pages.length;
    report('copying', copiedCount);
  }

  // 7–9: เรียงหน้า ประยุกต์ใช้การหมุน และเพิ่มลงเอกสารผลลัพธ์
  ensureActive();
  for (let i = 0; i < total; i += 1) {
    const page = copied[i];
    if (!page) throw new MergeError('copy-failed');
    const base = normalizeRotation(page.getRotation().angle);
    page.setRotation(degrees(normalizeRotation(base + items[i].rotation)));
    output.addPage(page);
  }

  // 10: บันทึกเป็น Binary Data
  ensureActive();
  report('saving', total);
  let bytes: Uint8Array;
  try {
    bytes = await output.save({ useObjectStreams: true, objectsPerTick: 100 });
  } catch (error) {
    throw wrapError(error, 'save-failed');
  }

  // 11–12: ตรวจสอบว่าไฟล์ไม่ว่าง อ่านกลับได้ และจำนวนหน้าถูกต้อง
  ensureActive();
  report('verifying', total);
  if (bytes.length === 0) throw new MergeError('empty-output');
  let verified: PDFDocument;
  try {
    verified = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (error) {
    throw wrapError(error, 'verify-failed');
  }
  if (verified.getPageCount() !== total) throw new MergeError('page-count-mismatch');

  ensureActive();
  report('done', total);
  return { bytes, pageCount: total };
}
