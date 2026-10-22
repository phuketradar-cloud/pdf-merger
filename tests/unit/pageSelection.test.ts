import { describe, expect, it } from 'vitest';
import { evenPageNumbers, oddPageNumbers, parsePageRanges } from '../../src/utils/pageSelection';

describe('parsePageRanges', () => {
  it('รองรับช่วงหน้า 1-5', () => {
    expect(parsePageRanges('1-5', 10)).toEqual({ ok: true, pages: [1, 2, 3, 4, 5] });
  });

  it('รองรับรายการผสม 1, 3, 5-7', () => {
    expect(parsePageRanges('1, 3, 5-7', 10)).toEqual({ ok: true, pages: [1, 3, 5, 6, 7] });
  });

  it('รองรับ en dash, ช่องว่าง และตัดหน้าซ้ำ', () => {
    expect(parsePageRanges(' 2–3 , 3 ,1 ', 5)).toEqual({ ok: true, pages: [1, 2, 3] });
  });

  it('ปฏิเสธหน้าที่เกินจำนวน', () => {
    const result = parsePageRanges('1-12', 10);
    expect(result.ok).toBe(false);
  });

  it('ปฏิเสธช่วงกลับด้าน หน้า 0 และรูปแบบผิด', () => {
    expect(parsePageRanges('5-1', 10).ok).toBe(false);
    expect(parsePageRanges('0', 10).ok).toBe(false);
    expect(parsePageRanges('a-b', 10).ok).toBe(false);
    expect(parsePageRanges('', 10).ok).toBe(false);
  });
});

describe('odd/even pages', () => {
  it('เลือกหน้าคี่และหน้าคู่', () => {
    expect(oddPageNumbers(7)).toEqual([1, 3, 5, 7]);
    expect(evenPageNumbers(7)).toEqual([2, 4, 6]);
    expect(evenPageNumbers(1)).toEqual([]);
  });
});
