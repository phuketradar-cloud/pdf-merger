import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';

export const A4: [number, number] = [595.28, 841.89];
export const A4_LANDSCAPE: [number, number] = [841.89, 595.28];
export const LETTER: [number, number] = [612, 792];
export const A5: [number, number] = [419.53, 595.28];

export interface PageSpec {
  size: [number, number];
  rotation?: number;
  label?: string;
}

/** สร้างไฟล์ PDF ทดสอบจริงด้วย pdf-lib (แต่ละหน้ามีข้อความระบุชื่อหน้า) */
export async function makePdf(pages: PageSpec[] | number, size: [number, number] = A4): Promise<Uint8Array> {
  const specs: PageSpec[] = typeof pages === 'number' ? Array.from({ length: pages }, () => ({ size })) : pages;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  specs.forEach((spec, i) => {
    const page = doc.addPage(spec.size);
    page.drawText(spec.label ?? `Page ${i + 1}`, { x: 40, y: spec.size[1] - 60, size: 24, font });
    if (spec.rotation) page.setRotation(degrees(spec.rotation));
  });
  return doc.save();
}

/** สร้าง PDF ที่มีการเข้ารหัส (มี /Encrypt ใน trailer) เพื่อทดสอบการตรวจจับไฟล์ที่มีรหัสผ่าน */
export async function makeEncryptedPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage(A4);
  doc.context.trailerInfo.Encrypt = doc.context.obj({ Filter: 'Standard', V: 2, R: 3, Length: 128, P: -4 });
  return doc.save({ useObjectStreams: false });
}

export function toFile(bytes: Uint8Array, name: string, type = 'application/pdf'): File {
  return new File([bytes], name, { type });
}
