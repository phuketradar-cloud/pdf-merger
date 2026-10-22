import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PDFDocument } from 'pdf-lib';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { A4, A5, LETTER, makePdf, toFile } from '../helpers/makePdf';

// jsdom ไม่มี canvas จึงจำลองเฉพาะส่วนแสดงภาพตัวอย่าง ส่วนการรวม PDF ใช้ของจริงทั้งหมด
vi.mock('../../src/services/pdfRenderer', () => ({
  renderPageImage: vi.fn(async () => 'data:image/gif;base64,R0lGODlhAQABAAAAACw='),
  releaseDocument: vi.fn(async () => undefined),
  releaseAllDocuments: vi.fn(async () => undefined),
}));

const saved: Array<{ bytes: Uint8Array; name: string }> = [];
vi.mock('../../src/services/downloadService', () => ({
  canChooseSaveLocation: () => false,
  saveOutput: vi.fn(async (bytes: Uint8Array, name: string) => {
    saved.push({ bytes, name });
    return 'downloaded';
  }),
}));

async function fixtures() {
  return [
    toFile(await makePdf(2, A4), 'หนังสือราชการ.pdf'),
    toFile(await makePdf(5, LETTER), 'เอกสารแนบ.pdf'),
    toFile(await makePdf(3, A5), 'ภาคผนวก.pdf'),
  ];
}

async function addFiles(user: ReturnType<typeof userEvent.setup>, files: File[]) {
  await user.upload(screen.getByTestId('file-input'), files);
}

describe('ขั้นตอนการรวมไฟล์ผ่านหน้าจอ', () => {
  beforeEach(() => {
    saved.length = 0;
  });

  it('เพิ่ม 3 ไฟล์ เปลี่ยนลำดับ เลือกบางหน้า หมุน รวม และดาวน์โหลดได้ถูกต้อง', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addFiles(user, await fixtures());

    await waitFor(() => expect(screen.getByTestId('overall-status')).toHaveTextContent('พร้อมรวมไฟล์'));
    expect(screen.getByTestId('total-pages')).toHaveTextContent('10');
    expect(screen.getAllByTestId('page-card')).toHaveLength(10);

    // ย้าย ภาคผนวก (ลำดับ 3) ขึ้นไปเป็นลำดับแรก → ภาคผนวก, หนังสือราชการ, เอกสารแนบ
    const items = screen.getAllByTestId('file-item');
    await user.click(within(items[2]).getByRole('button', { name: /ขึ้น/ }));
    await user.click(within(screen.getAllByTestId('file-item')[1]).getByRole('button', { name: /ขึ้น/ }));
    expect(screen.getAllByTestId('file-item').map((el) => within(el).getByText(/\.pdf$/).textContent)).toEqual([
      'ภาคผนวก.pdf',
      'หนังสือราชการ.pdf',
      'เอกสารแนบ.pdf',
    ]);

    // ไม่เลือก "เอกสารแนบ" หน้า 2 และ 4
    await user.click(screen.getByRole('checkbox', { name: 'เลือก เอกสารแนบ.pdf หน้าเดิม 2' }));
    await user.click(screen.getByRole('checkbox', { name: 'เลือก เอกสารแนบ.pdf หน้าเดิม 4' }));
    expect(screen.getByTestId('output-page-count')).toHaveTextContent('8');

    // หมุนหน้าแรกของ "หนังสือราชการ" ไปทางขวา
    await user.click(screen.getByRole('button', { name: 'หมุนขวา หนังสือราชการ.pdf หน้าเดิม 1' }));

    await user.clear(screen.getByLabelText('ชื่อไฟล์ผลลัพธ์'));
    await user.type(screen.getByLabelText('ชื่อไฟล์ผลลัพธ์'), 'เอกสารรวม');
    await user.click(screen.getByRole('button', { name: /รวมไฟล์ PDF/ }));

    await waitFor(() => expect(screen.getByTestId('merge-result')).toBeInTheDocument(), { timeout: 15000 });
    expect(screen.getByTestId('merge-result')).toHaveTextContent('8 หน้า');

    await user.click(screen.getByRole('button', { name: /ดาวน์โหลดไฟล์/ }));
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('เอกสารรวม.pdf');

    const doc = await PDFDocument.load(saved[0].bytes);
    const pages = doc.getPages().map((p) => ({ w: Math.round(p.getWidth()), r: p.getRotation().angle }));
    expect(pages.map((p) => p.w)).toEqual([420, 420, 420, 595, 595, 612, 612, 612]);
    expect(pages[3].r).toBe(90);
    expect(pages.filter((p) => p.r !== 0)).toHaveLength(1);
  });

  it('ไฟล์ที่ไม่ใช่ PDF จริงแสดงข้อผิดพลาด โดยไฟล์ปกติยังอยู่ครบ', async () => {
    const user = userEvent.setup();
    render(<App />);
    const good = toFile(await makePdf(2), 'ปกติ.pdf');
    const fake = toFile(new TextEncoder().encode('not a pdf'), 'ปลอม.pdf');
    await addFiles(user, [good, fake]);

    await waitFor(() => expect(screen.getByText(/ไฟล์ ปลอม\.pdf ไม่ใช่ไฟล์ PDF จริง/)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('total-pages')).toHaveTextContent('2'));
    expect(screen.getAllByTestId('file-item')).toHaveLength(2);
    expect(screen.getByTestId('overall-status')).toHaveTextContent('พร้อมรวมไฟล์');
  });

  it('ปุ่มรวมไฟล์ถูกปิดเมื่อไม่มีหน้าที่เลือก และเริ่มต้นใหม่ได้', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addFiles(user, [toFile(await makePdf(1), 'one.pdf')]);
    await waitFor(() => expect(screen.getByTestId('total-pages')).toHaveTextContent('1'));

    await user.click(screen.getByRole('checkbox', { name: 'เลือก one.pdf หน้าเดิม 1' }));
    expect(screen.getByRole('button', { name: /รวมไฟล์ PDF/ })).toBeDisabled();
    expect(screen.getByText(/ยังไม่มีหน้าที่เลือกสำหรับรวม/)).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /เริ่มต้นใหม่/ })[0]);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'เริ่มต้นใหม่' }));
    expect(screen.queryAllByTestId('file-item')).toHaveLength(0);
  });

  it('ลบหน้าพร้อมข้อความยืนยัน และกู้คืนได้', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addFiles(user, [toFile(await makePdf(3), 'three.pdf')]);
    await waitFor(() => expect(screen.getByTestId('total-pages')).toHaveTextContent('3'));

    await user.click(screen.getByRole('button', { name: 'ลบ three.pdf หน้าเดิม 2' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ลบ 1 หน้า' }));
    expect(screen.getByTestId('total-pages')).toHaveTextContent('2');

    await user.click(screen.getByRole('button', { name: 'กู้คืน' }));
    expect(screen.getByTestId('total-pages')).toHaveTextContent('3');
  });
});
