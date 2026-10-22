export type RangeParseResult = { ok: true; pages: number[] } | { ok: false; error: string };

/**
 * แปลงข้อความเลือกหน้า เช่น "1-5" หรือ "1, 3, 5-7" เป็นรายการหมายเลขหน้า (เริ่มที่ 1, เรียงจากน้อยไปมาก, ไม่ซ้ำ)
 */
export function parsePageRanges(input: string, maxPage: number): RangeParseResult {
  const text = input.replace(/[–—]/g, '-').trim();
  if (!text) {
    return { ok: false, error: 'กรุณาระบุหมายเลขหน้า เช่น 1-5 หรือ 1, 3, 5-7' };
  }
  if (maxPage < 1) {
    return { ok: false, error: 'ไม่มีหน้าให้เลือก' };
  }

  const pages = new Set<number>();
  const parts = text.split(/[,\s]+/).filter(Boolean);

  for (const part of parts) {
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    const single = /^(\d+)$/.exec(part);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start < 1 || end < 1) return { ok: false, error: `หมายเลขหน้า "${part}" ต้องเริ่มที่ 1` };
      if (start > end) return { ok: false, error: `ช่วง "${part}" ไม่ถูกต้อง หน้าเริ่มต้นต้องไม่มากกว่าหน้าสุดท้าย` };
      if (end > maxPage) return { ok: false, error: `ช่วง "${part}" เกินจำนวนหน้าที่มี (${maxPage} หน้า)` };
      for (let p = start; p <= end; p += 1) pages.add(p);
    } else if (single) {
      const p = Number(single[1]);
      if (p < 1 || p > maxPage) return { ok: false, error: `หน้า ${p} ไม่อยู่ในช่วง 1–${maxPage}` };
      pages.add(p);
    } else {
      return { ok: false, error: `รูปแบบ "${part}" ไม่ถูกต้อง ใช้ตัวเลข เครื่องหมาย - และ , เท่านั้น` };
    }
  }

  return { ok: true, pages: [...pages].sort((a, b) => a - b) };
}

/** หมายเลขหน้าคี่ (1, 3, 5, …) จากทั้งหมด count หน้า */
export function oddPageNumbers(count: number): number[] {
  const result: number[] = [];
  for (let p = 1; p <= count; p += 2) result.push(p);
  return result;
}

/** หมายเลขหน้าคู่ (2, 4, 6, …) จากทั้งหมด count หน้า */
export function evenPageNumbers(count: number): number[] {
  const result: number[] = [];
  for (let p = 2; p <= count; p += 2) result.push(p);
  return result;
}
