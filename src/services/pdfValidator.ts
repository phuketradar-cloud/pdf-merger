import { PDFDocument } from 'pdf-lib';
import type { AppLimits } from '../config/limits';
import type { PageInfo } from '../types/pdf';
import { formatBytes } from '../utils/fileSize';
import { hasPdfExtension } from '../utils/fileName';
import { normalizeRotation } from '../utils/rotation';

export type ValidationErrorCode =
  | 'not-pdf'
  | 'empty'
  | 'too-large'
  | 'no-header'
  | 'truncated'
  | 'encrypted'
  | 'corrupt'
  | 'no-pages'
  | 'too-many-pages'
  | 'out-of-memory';

export interface ValidationFailure {
  ok: false;
  code: ValidationErrorCode;
  message: string;
  hint: string;
}

export interface ValidationSuccess {
  ok: true;
  pageCount: number;
  pageInfos: PageInfo[];
  warning: string | null;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

const PDF_MIME_TYPES = new Set(['application/pdf', 'application/x-pdf', '']);

function fail(code: ValidationErrorCode, message: string, hint: string): ValidationFailure {
  return { ok: false, code, message, hint };
}

/** ตรวจข้อมูลพื้นฐานก่อนอ่านไฟล์ (นามสกุล, MIME Type, ขนาด) – ไม่ถือว่าผ่านจนกว่าจะตรวจโครงสร้างจริง */
export function checkFileMeta(
  name: string,
  size: number,
  mimeType: string,
  limits: AppLimits,
): ValidationFailure | null {
  if (!hasPdfExtension(name)) {
    return fail('not-pdf', `ไฟล์ ${name} ไม่ใช่ไฟล์ PDF`, 'ระบบรองรับเฉพาะไฟล์นามสกุล .pdf เท่านั้น');
  }
  if (!PDF_MIME_TYPES.has(mimeType.toLowerCase())) {
    return fail('not-pdf', `ไฟล์ ${name} ไม่ใช่ไฟล์ PDF (ชนิดไฟล์: ${mimeType})`, 'กรุณาเลือกไฟล์ PDF ที่ถูกต้อง');
  }
  if (size === 0) {
    return fail('empty', `ไฟล์ ${name} เป็นไฟล์ว่าง (0 ไบต์)`, 'กรุณาตรวจสอบไฟล์ต้นฉบับ หรือดาวน์โหลด/คัดลอกไฟล์ใหม่อีกครั้ง');
  }
  if (size > limits.maxFileSizeBytes) {
    return fail(
      'too-large',
      `ไฟล์ ${name} มีขนาด ${formatBytes(size)} เกินค่าที่โปรแกรมกำหนด (${formatBytes(limits.maxFileSizeBytes)})`,
      'ลองบีบอัดไฟล์หรือแบ่งไฟล์เป็นส่วนย่อยก่อนนำมารวม',
    );
  }
  return null;
}

/** ตรวจลายเซ็นไฟล์ "%PDF-" ภายใน 1024 ไบต์แรก ตามที่ข้อกำหนด PDF อนุญาต */
export function hasPdfSignature(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length - 4, 1024);
  for (let i = 0; i < limit; i += 1) {
    if (
      bytes[i] === 0x25 && // %
      bytes[i + 1] === 0x50 && // P
      bytes[i + 2] === 0x44 && // D
      bytes[i + 3] === 0x46 && // F
      bytes[i + 4] === 0x2d // -
    ) {
      return true;
    }
  }
  return false;
}

/** ตรวจว่ามีเครื่องหมายสิ้นสุดไฟล์ "%%EOF" ในช่วงท้ายไฟล์หรือไม่ (ไฟล์ถูกตัดขาดมักไม่มี) */
export function hasEofMarker(bytes: Uint8Array): boolean {
  const start = Math.max(0, bytes.length - 2048);
  for (let i = bytes.length - 5; i >= start; i -= 1) {
    if (
      bytes[i] === 0x25 &&
      bytes[i + 1] === 0x25 &&
      bytes[i + 2] === 0x45 && // E
      bytes[i + 3] === 0x4f && // O
      bytes[i + 4] === 0x46 // F
    ) {
      return true;
    }
  }
  return false;
}

function isEncryptedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'EncryptedPDFError' || /encrypted/i.test(error.message);
}

function isMemoryError(error: unknown): boolean {
  return error instanceof RangeError || (error instanceof Error && /memory|allocation/i.test(error.message));
}

/** ตรวจโครงสร้าง PDF จริงด้วย PDF Parser (pdf-lib) – ไม่เชื่อถือเพียงนามสกุลหรือ MIME Type */
export async function validatePdfBytes(name: string, bytes: Uint8Array, limits: AppLimits): Promise<ValidationResult> {
  if (bytes.length === 0) {
    return fail('empty', `ไฟล์ ${name} เป็นไฟล์ว่าง (0 ไบต์)`, 'กรุณาตรวจสอบไฟล์ต้นฉบับ');
  }
  if (!hasPdfSignature(bytes)) {
    return fail(
      'no-header',
      `ไฟล์ ${name} ไม่ใช่ไฟล์ PDF จริง แม้จะมีนามสกุล .pdf`,
      'ไฟล์อาจถูกเปลี่ยนนามสกุลจากไฟล์ชนิดอื่น กรุณาเปิดไฟล์ด้วยโปรแกรมต้นทางแล้วบันทึกเป็น PDF ใหม่',
    );
  }
  const eofPresent = hasEofMarker(bytes);

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (error) {
    if (isEncryptedError(error)) {
      return fail(
        'encrypted',
        `ไฟล์ ${name} มีการป้องกันด้วยรหัสผ่านหรือเข้ารหัส`,
        'โปรแกรมนี้ไม่ถอดรหัสไฟล์ กรุณาเปิดไฟล์ด้วยโปรแกรมอ่าน PDF ใส่รหัสผ่าน แล้วบันทึกสำเนาแบบไม่มีรหัสผ่าน (เช่น Print to PDF) ก่อนนำมารวม',
      );
    }
    if (isMemoryError(error)) {
      return fail('out-of-memory', `หน่วยความจำไม่เพียงพอสำหรับเปิดไฟล์ ${name}`, 'ลองปิดโปรแกรมอื่นหรือแบ่งไฟล์ให้เล็กลง');
    }
    if (!eofPresent) {
      return fail(
        'truncated',
        `ไฟล์ ${name} ไม่สมบูรณ์ (อาจดาวน์โหลดหรือคัดลอกไม่ครบ)`,
        'กรุณาดาวน์โหลดหรือคัดลอกไฟล์ต้นฉบับใหม่อีกครั้ง',
      );
    }
    return fail(
      'corrupt',
      `ไม่สามารถเปิดไฟล์ ${name} ได้ เนื่องจากไฟล์อาจเสียหาย`,
      'กรุณาตรวจสอบไฟล์ต้นฉบับและลองอีกครั้ง',
    );
  }

  let pageCount: number;
  let pageInfos: PageInfo[];
  try {
    const pages = doc.getPages();
    pageCount = pages.length;
    pageInfos = pages.map((page) => {
      const { width, height } = page.getSize();
      return { width, height, rotation: normalizeRotation(page.getRotation().angle) };
    });
  } catch {
    return fail('corrupt', `ไม่สามารถอ่านโครงสร้างหน้าของไฟล์ ${name} ได้`, 'ไฟล์อาจเสียหาย กรุณาบันทึกไฟล์ใหม่จากโปรแกรมต้นทาง');
  }

  if (pageCount === 0) {
    return fail(
      eofPresent ? 'no-pages' : 'truncated',
      eofPresent ? `ไฟล์ ${name} ไม่มีหน้าเอกสาร` : `ไฟล์ ${name} ไม่สมบูรณ์และไม่พบหน้าเอกสาร`,
      'กรุณาตรวจสอบไฟล์ต้นฉบับ',
    );
  }
  if (pageCount > limits.maxPagesPerFile) {
    return fail(
      'too-many-pages',
      `ไฟล์ ${name} มี ${pageCount.toLocaleString('th-TH')} หน้า เกินค่าที่โปรแกรมกำหนด (${limits.maxPagesPerFile.toLocaleString('th-TH')} หน้าต่อไฟล์)`,
      'กรุณาแบ่งไฟล์ให้มีจำนวนหน้าน้อยลงก่อนนำมารวม',
    );
  }

  return {
    ok: true,
    pageCount,
    pageInfos,
    warning: eofPresent ? null : 'ไม่พบเครื่องหมายสิ้นสุดไฟล์ ไฟล์อาจไม่สมบูรณ์ กรุณาตรวจสอบผลลัพธ์หลังรวม',
  };
}
