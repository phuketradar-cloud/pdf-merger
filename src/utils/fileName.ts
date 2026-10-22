export const DEFAULT_OUTPUT_NAME = 'merged-document.pdf';

const FORBIDDEN_CHARS = /[<>:"/\\|?*]/g;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const MAX_LENGTH = 200;

export type FileNameResult = { ok: true; name: string; changed: boolean } | { ok: false; error: string };

/**
 * ตรวจสอบและปรับชื่อไฟล์ผลลัพธ์ให้ปลอดภัย
 * - รองรับภาษาไทยและภาษาอังกฤษ (ไม่ตัดอักขระไทยออก)
 * - แทนที่อักขระที่ระบบไฟล์ไม่รองรับด้วย "-"
 * - เติม .pdf อัตโนมัติหากไม่มี
 */
export function sanitizeFileName(input: string): FileNameResult {
  const trimmed = input.normalize('NFC').trim();
  if (!trimmed) {
    return { ok: false, error: 'กรุณาตั้งชื่อไฟล์ผลลัพธ์' };
  }

  let base = trimmed.replace(/\.pdf$/i, '');
  base = base.replace(CONTROL_CHARS, '').replace(FORBIDDEN_CHARS, '-');
  base = base.replace(/[. ]+$/g, '').trim();

  if (!base || /^[-. ]+$/.test(base)) {
    return { ok: false, error: 'ชื่อไฟล์ไม่ถูกต้อง กรุณาใช้ตัวอักษรหรือตัวเลขอย่างน้อย 1 ตัว' };
  }
  if (RESERVED_WINDOWS_NAMES.test(base)) {
    base = `_${base}`;
  }

  const chars = Array.from(base);
  if (chars.length > MAX_LENGTH) {
    base = chars.slice(0, MAX_LENGTH).join('').trim();
  }

  const name = `${base}.pdf`;
  const changed = name !== trimmed;
  return { ok: true, name, changed };
}

export function hasPdfExtension(name: string): boolean {
  return /\.pdf$/i.test(name.trim());
}
