import { describe, expect, it } from 'vitest';
import type { PdfFileEntry } from '../../src/types/pdf';
import { sanitizeFileName } from '../../src/utils/fileName';
import { moveItem, sortFiles } from '../../src/utils/fileOrdering';
import { formatBytes, pointsToMm } from '../../src/utils/fileSize';
import { addRotation, normalizeRotation } from '../../src/utils/rotation';

describe('sanitizeFileName', () => {
  it('เติม .pdf เมื่อไม่มีนามสกุล', () => {
    expect(sanitizeFileName('report')).toEqual({ ok: true, name: 'report.pdf', changed: true });
  });

  it('คงชื่อภาษาไทยไว้ครบ', () => {
    expect(sanitizeFileName('หนังสือราชการ ฉบับรวม.pdf')).toEqual({
      ok: true,
      name: 'หนังสือราชการ ฉบับรวม.pdf',
      changed: false,
    });
  });

  it('ไม่เติม .pdf ซ้ำ และรองรับตัวพิมพ์ใหญ่', () => {
    const r = sanitizeFileName('Doc.PDF');
    expect(r.ok && r.name).toBe('Doc.pdf');
  });

  it('แทนที่อักขระต้องห้ามของ Windows', () => {
    const r = sanitizeFileName('a/b:c*?.pdf');
    expect(r.ok && r.name).toBe('a-b-c--.pdf');
  });

  it('ป้องกันชื่อว่างและชื่อที่ไม่มีตัวอักษร', () => {
    expect(sanitizeFileName('   ').ok).toBe(false);
    expect(sanitizeFileName('.pdf').ok).toBe(false);
    expect(sanitizeFileName('///').ok).toBe(false);
  });

  it('ป้องกันชื่อสงวนของ Windows', () => {
    const r = sanitizeFileName('CON');
    expect(r.ok && r.name).toBe('_CON.pdf');
  });
});

describe('formatBytes / pointsToMm', () => {
  it('แสดงขนาดไฟล์', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1536)).toBe('1.50 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.00 MB');
  });
  it('แปลง point เป็น มม.', () => {
    expect(pointsToMm(595.28)).toBe(210);
    expect(pointsToMm(841.89)).toBe(297);
  });
});

describe('rotation', () => {
  it('หมุนวนรอบ 360 องศา', () => {
    expect(addRotation(0, -90)).toBe(270);
    expect(addRotation(270, 90)).toBe(0);
    expect(normalizeRotation(-450)).toBe(270);
    expect(normalizeRotation(540)).toBe(180);
  });
});

function entry(name: string, size: number, pageCount: number, addedOrder: number): PdfFileEntry {
  return {
    id: name,
    name,
    size,
    pageCount,
    addedOrder,
    status: 'ready',
    bytes: null,
    pageInfos: [],
    error: null,
    errorHint: null,
    warning: null,
  };
}

describe('sortFiles / moveItem', () => {
  const files = [entry('file10.pdf', 300, 1, 0), entry('file2.pdf', 100, 9, 1), entry('ภาคผนวก.pdf', 200, 3, 2)];

  it('เรียงตามชื่อแบบเข้าใจตัวเลข', () => {
    // ตำแหน่งของชื่อไทยเทียบกับอังกฤษขึ้นกับ locale (th) จึงตรวจเฉพาะลำดับตัวเลขในชื่อ
    const asc = sortFiles(files, 'name-asc').map((f) => f.name);
    expect(asc.indexOf('file2.pdf')).toBeLessThan(asc.indexOf('file10.pdf'));
    const desc = sortFiles(files, 'name-desc').map((f) => f.name);
    expect(desc).toEqual([...asc].reverse());
  });

  it('เรียงตามขนาดและจำนวนหน้า', () => {
    expect(sortFiles(files, 'size-asc').map((f) => f.size)).toEqual([100, 200, 300]);
    expect(sortFiles(files, 'pages-desc').map((f) => f.pageCount)).toEqual([9, 3, 1]);
  });

  it('ย้ายรายการ', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, 99)).toEqual(['b', 'c', 'a']);
  });
});
