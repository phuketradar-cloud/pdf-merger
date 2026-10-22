// @vitest-environment node
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { MergeError, mergePdf } from '../../src/services/pdfMerger';
import type { MergeItem, MergeProgress, MergeSource, Rotation } from '../../src/types/pdf';
import { A4, A4_LANDSCAPE, A5, LETTER, makePdf } from '../helpers/makePdf';

async function sources(): Promise<MergeSource[]> {
  return [
    { fileId: 'a', fileName: 'หนังสือราชการ.pdf', bytes: await makePdf(2, A4) },
    { fileId: 'b', fileName: 'เอกสารแนบ.pdf', bytes: await makePdf(5, LETTER) },
    { fileId: 'c', fileName: 'ภาคผนวก.pdf', bytes: await makePdf(3, A5) },
  ];
}

function allPages(fileId: string, count: number, rotation: Rotation = 0): MergeItem[] {
  return Array.from({ length: count }, (_, sourceIndex) => ({ fileId, sourceIndex, rotation }));
}

async function sizes(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((p) => {
    const { width, height } = p.getSize();
    return { width: Math.round(width), height: Math.round(height), rotation: p.getRotation().angle };
  });
}

describe('mergePdf', () => {
  it('รวม 3 ไฟล์ (2+5+3) เป็น 10 หน้า ตามลำดับที่กำหนด', async () => {
    const src = await sources();
    const items = [...allPages('a', 2), ...allPages('b', 5), ...allPages('c', 3)];
    const result = await mergePdf(src, items);
    expect(result.pageCount).toBe(10);
    const out = await sizes(result.bytes);
    expect(out).toHaveLength(10);
    expect(out.slice(0, 2).every((p) => p.width === 595)).toBe(true);
    expect(out.slice(2, 7).every((p) => p.width === 612)).toBe(true);
    expect(out.slice(7).every((p) => p.width === 420)).toBe(true);
  });

  it('เปลี่ยนลำดับเป็น ภาคผนวก → หนังสือราชการ → เอกสารแนบ', async () => {
    const src = await sources();
    const items = [...allPages('c', 3), ...allPages('a', 2), ...allPages('b', 5)];
    const out = await sizes((await mergePdf(src, items)).bytes);
    expect(out.map((p) => p.width)).toEqual([420, 420, 420, 595, 595, 612, 612, 612, 612, 612]);
  });

  it('เลือกเฉพาะบางหน้าและเรียงหน้าข้ามไฟล์', async () => {
    const src = await sources();
    const items: MergeItem[] = [
      { fileId: 'b', sourceIndex: 4, rotation: 0 },
      { fileId: 'a', sourceIndex: 0, rotation: 0 },
      { fileId: 'c', sourceIndex: 1, rotation: 0 },
      { fileId: 'b', sourceIndex: 0, rotation: 0 },
    ];
    const out = await sizes((await mergePdf(src, items)).bytes);
    expect(out.map((p) => p.width)).toEqual([612, 595, 420, 612]);
  });

  it('บันทึกการหมุนลงใน PDF จริง และรวมกับมุมเดิมของหน้า', async () => {
    const src: MergeSource[] = [
      { fileId: 'r', fileName: 'r.pdf', bytes: await makePdf([{ size: A4 }, { size: A4_LANDSCAPE, rotation: 90 }]) },
    ];
    const items: MergeItem[] = [
      { fileId: 'r', sourceIndex: 0, rotation: 90 },
      { fileId: 'r', sourceIndex: 1, rotation: 270 },
    ];
    const out = await sizes((await mergePdf(src, items)).bytes);
    expect(out[0].rotation).toBe(90);
    expect(out[1].rotation).toBe(0); // 90 + 270 = 360 → 0
    // ขนาดหน้ากระดาษเดิมได้รับการรักษา (MediaBox ไม่เปลี่ยน)
    expect(out[1]).toMatchObject({ width: 842, height: 595 });
  });

  it('รองรับการเพิ่มไฟล์เดียวกันซ้ำ (คนละ fileId)', async () => {
    const bytes = await makePdf(2);
    const src: MergeSource[] = [
      { fileId: 'x1', fileName: 'same.pdf', bytes },
      { fileId: 'x2', fileName: 'same.pdf', bytes },
    ];
    const result = await mergePdf(src, [...allPages('x1', 2), ...allPages('x2', 2)]);
    expect(result.pageCount).toBe(4);
  });

  it('ไม่แก้ไขข้อมูลไฟล์ต้นฉบับ', async () => {
    const src = await sources();
    const before = src.map((s) => s.bytes.slice());
    await mergePdf(src, [...allPages('a', 2)]);
    src.forEach((s, i) => expect(s.bytes).toEqual(before[i]));
  });

  it('รายงานความคืบหน้าเป็นขั้นตอน และจบที่ done', async () => {
    const src = await sources();
    const stages: MergeProgress['stage'][] = [];
    await mergePdf(src, allPages('b', 5), { onProgress: (p) => stages.push(p.stage) });
    expect(stages[0]).toBe('preparing');
    expect(stages).toContain('copying');
    expect(stages).toContain('saving');
    expect(stages).toContain('verifying');
    expect(stages.at(-1)).toBe('done');
  });

  it('แจ้งข้อผิดพลาดเมื่อไม่มีหน้า', async () => {
    await expect(mergePdf(await sources(), [])).rejects.toMatchObject({ code: 'no-pages' });
  });

  it('แจ้งข้อผิดพลาดเมื่อไม่พบไฟล์ต้นฉบับ', async () => {
    await expect(mergePdf([], allPages('zzz', 1))).rejects.toMatchObject({ code: 'missing-source' });
  });

  it('แจ้งข้อผิดพลาดเมื่ออ้างถึงหน้าที่ไม่มีอยู่', async () => {
    await expect(mergePdf(await sources(), [{ fileId: 'a', sourceIndex: 9, rotation: 0 }])).rejects.toMatchObject({
      code: 'invalid-page',
      fileName: 'หนังสือราชการ.pdf',
    });
  });

  it('แจ้งข้อผิดพลาดพร้อมชื่อไฟล์เมื่อไฟล์ต้นฉบับเสีย', async () => {
    const src: MergeSource[] = [{ fileId: 'bad', fileName: 'เสีย.pdf', bytes: new TextEncoder().encode('%PDF-1.7 garbage') }];
    const error = await mergePdf(src, allPages('bad', 1)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MergeError);
    expect((error as MergeError).fileName).toBe('เสีย.pdf');
  });

  it('ยกเลิกการทำงานได้', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(mergePdf(await sources(), allPages('a', 2), { signal: controller.signal })).rejects.toMatchObject({
      code: 'cancelled',
    });
  });
});
