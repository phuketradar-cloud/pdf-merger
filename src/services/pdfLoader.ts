import type { AppLimits } from '../config/limits';
import { checkFileMeta, validatePdfBytes, type ValidationResult } from './pdfValidator';

/** อ่านไฟล์เป็นไบต์ (รองรับเบราว์เซอร์ที่ไม่มี File.arrayBuffer) */
export async function readFileBytes(file: Blob): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer());
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error('read-failed'));
    reader.readAsArrayBuffer(file);
  });
}

export type LoadResult = { validation: ValidationResult; bytes: Uint8Array | null };

/** ตรวจข้อมูลพื้นฐาน อ่านไฟล์ และตรวจโครงสร้าง PDF จริง */
export async function loadPdfFile(file: File, limits: AppLimits): Promise<LoadResult> {
  const metaFailure = checkFileMeta(file.name, file.size, file.type, limits);
  if (metaFailure) return { validation: metaFailure, bytes: null };

  let bytes: Uint8Array;
  try {
    bytes = await readFileBytes(file);
  } catch (error) {
    const memory = error instanceof RangeError;
    return {
      bytes: null,
      validation: {
        ok: false,
        code: memory ? 'out-of-memory' : 'corrupt',
        message: memory ? `หน่วยความจำไม่เพียงพอสำหรับอ่านไฟล์ ${file.name}` : `เกิดข้อผิดพลาดขณะอ่านไฟล์ ${file.name}`,
        hint: memory
          ? 'ลองปิดโปรแกรมอื่นหรือแบ่งไฟล์ให้เล็กลง'
          : 'ไฟล์อาจถูกย้าย ลบ หรือเปิดค้างในโปรแกรมอื่น กรุณาเลือกไฟล์ใหม่อีกครั้ง',
      },
    };
  }

  const validation = await validatePdfBytes(file.name, bytes, limits);
  return { validation, bytes: validation.ok ? bytes : null };
}
