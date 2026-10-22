// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_LIMITS } from '../../src/config/limits';
import { checkFileMeta, hasEofMarker, hasPdfSignature, validatePdfBytes } from '../../src/services/pdfValidator';
import { A4, A4_LANDSCAPE, makeEncryptedPdf, makePdf } from '../helpers/makePdf';

const limits = DEFAULT_LIMITS;

describe('checkFileMeta', () => {
  it('ปฏิเสธไฟล์ที่ไม่ใช่ .pdf', () => {
    expect(checkFileMeta('photo.jpg', 100, 'image/jpeg', limits)?.code).toBe('not-pdf');
  });
  it('ปฏิเสธ MIME Type ที่ไม่ใช่ PDF แม้นามสกุลเป็น .pdf', () => {
    expect(checkFileMeta('fake.pdf', 100, 'image/png', limits)?.code).toBe('not-pdf');
  });
  it('ปฏิเสธไฟล์ว่าง', () => {
    expect(checkFileMeta('empty.pdf', 0, 'application/pdf', limits)?.code).toBe('empty');
  });
  it('ปฏิเสธไฟล์ใหญ่เกินค่าที่กำหนด', () => {
    expect(checkFileMeta('big.pdf', limits.maxFileSizeBytes + 1, 'application/pdf', limits)?.code).toBe('too-large');
  });
  it('ผ่านเมื่อข้อมูลพื้นฐานถูกต้อง (MIME ว่างได้)', () => {
    expect(checkFileMeta('ok.pdf', 100, '', limits)).toBeNull();
  });
});

describe('validatePdfBytes', () => {
  it('อ่านจำนวนหน้า ขนาด และมุมหมุนของ PDF จริง', async () => {
    const bytes = await makePdf([{ size: A4 }, { size: A4_LANDSCAPE, rotation: 90 }]);
    const result = await validatePdfBytes('doc.pdf', bytes, limits);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pageCount).toBe(2);
    expect(result.pageInfos[1]).toMatchObject({ width: A4_LANDSCAPE[0], height: A4_LANDSCAPE[1], rotation: 90 });
    expect(result.warning).toBeNull();
  });

  it('ไม่เชื่อนามสกุล: ไฟล์ข้อความที่ตั้งชื่อเป็น .pdf ถูกปฏิเสธ', async () => {
    const bytes = new TextEncoder().encode('hello this is not a pdf');
    const result = await validatePdfBytes('fake.pdf', bytes, limits);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.code).toBe('no-header');
  });

  it('ตรวจพบไฟล์ว่าง', async () => {
    const result = await validatePdfBytes('empty.pdf', new Uint8Array(), limits);
    expect(!result.ok && result.code).toBe('empty');
  });

  it('ตรวจพบไฟล์ที่ถูกตัดขาด', async () => {
    const full = await makePdf(3);
    const truncated = full.slice(0, 40);
    const result = await validatePdfBytes('cut.pdf', truncated, limits);
    expect(result.ok).toBe(false);
    expect(!result.ok && ['truncated', 'corrupt'].includes(result.code)).toBe(true);
  });

  it('ตรวจพบไฟล์ที่มีรหัสผ่าน/เข้ารหัส', async () => {
    const bytes = await makeEncryptedPdf();
    const result = await validatePdfBytes('secret.pdf', bytes, limits);
    expect(!result.ok && result.code).toBe('encrypted');
    expect(!result.ok && result.message).toContain('secret.pdf');
  });

  it('ปฏิเสธไฟล์ที่มีจำนวนหน้าเกินค่าที่กำหนด', async () => {
    const bytes = await makePdf(5);
    const result = await validatePdfBytes('many.pdf', bytes, { ...limits, maxPagesPerFile: 4 });
    expect(!result.ok && result.code).toBe('too-many-pages');
  });

  it('ตรวจลายเซ็นและเครื่องหมายท้ายไฟล์', async () => {
    const bytes = await makePdf(1);
    expect(hasPdfSignature(bytes)).toBe(true);
    expect(hasEofMarker(bytes)).toBe(true);
    expect(hasEofMarker(bytes.slice(0, bytes.length - 10))).toBe(false);
  });
});
