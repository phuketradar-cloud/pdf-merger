import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { A4, A5, LETTER, makePdf } from '../helpers/makePdf';

const root = process.cwd();
let app: ElectronApplication;
let page: Page;
let fixtures: string[];
let downloadDir: string;

test.beforeAll(async () => {
  const fixtureDir = join(root, 'tests', 'e2e', 'fixtures');
  mkdirSync(fixtureDir, { recursive: true });
  const specs: Array<[string, Uint8Array]> = [
    ['หนังสือราชการ.pdf', await makePdf(2, A4)],
    ['เอกสารแนบ.pdf', await makePdf(5, LETTER)],
    ['ภาคผนวก.pdf', await makePdf(3, A5)],
    ['broken.pdf', new TextEncoder().encode('this is not a pdf')],
  ];
  fixtures = specs.map(([name, bytes]) => {
    const file = join(fixtureDir, name);
    writeFileSync(file, bytes);
    return file;
  });

  downloadDir = mkdtempSync(join(tmpdir(), 'pdf-merger-e2e-'));
  app = await electron.launch({
    args: [join(root, 'electron', 'main.cjs')],
    env: { ...process.env, PDF_MERGER_TEST_DOWNLOAD_DIR: downloadDir },
  });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  // ข้ามกล่องยืนยันก่อนปิดโปรแกรม (เตือนเมื่อมีไฟล์ค้างอยู่) ซึ่งเป็นพฤติกรรมปกติของโปรแกรม
  await app?.evaluate(({ app: electronApp }) => electronApp.exit(0)).catch(() => undefined);
});

test('เปิดโปรแกรม รวมไฟล์จริง และไฟล์ผลลัพธ์ถูกต้อง', async () => {
  await expect(page.getByRole('heading', { name: 'PDF Merger' })).toBeVisible();

  // 2. เลือกไฟล์ PDF 3 ไฟล์ + ไฟล์เสีย 1 ไฟล์
  await page.getByTestId('file-input').setInputFiles(fixtures);
  await expect(page.getByTestId('overall-status')).toHaveText('พร้อมรวมไฟล์');
  await expect(page.getByText('ไฟล์ broken.pdf ไม่ใช่ไฟล์ PDF จริง', { exact: false })).toBeVisible();

  // 3. ตรวจสอบจำนวนหน้า
  await expect(page.getByTestId('total-pages')).toHaveText('10');
  await expect(page.getByTestId('page-card')).toHaveCount(10);

  // ภาพตัวอย่างถูกเรนเดอร์จริงด้วย pdf.js (ทำงาน Offline ภายในโปรแกรม)
  await expect(page.locator('.page-image img').first()).toHaveAttribute('src', /^data:image\/jpeg/, { timeout: 20_000 });

  // 4. เปลี่ยนลำดับไฟล์: ย้าย "ภาคผนวก" ไปลำดับที่ 1
  const appendix = page.getByTestId('file-item').filter({ hasText: 'ภาคผนวก.pdf' });
  await appendix.getByPlaceholder('ลำดับ').fill('1');
  await appendix.getByRole('button', { name: 'ย้าย', exact: true }).click();
  await expect(page.getByTestId('file-item').first()).toContainText('ภาคผนวก.pdf');

  // 5. ไม่เลือกหน้า 2 และ 4 ของเอกสารแนบ
  await page.getByRole('checkbox', { name: 'เลือก เอกสารแนบ.pdf หน้าเดิม 2' }).uncheck();
  await page.getByRole('checkbox', { name: 'เลือก เอกสารแนบ.pdf หน้าเดิม 4' }).uncheck();
  await expect(page.getByTestId('output-page-count')).toHaveText('8');

  // 6. หมุนหน้าแรกของหนังสือราชการ
  await page.getByRole('button', { name: 'หมุนขวา หนังสือราชการ.pdf หน้าเดิม 1' }).click();

  // 7. รวมไฟล์
  await page.getByLabel('ชื่อไฟล์ผลลัพธ์').fill('ผลลัพธ์ทดสอบ');
  await page.getByRole('button', { name: /รวมไฟล์ PDF/ }).click();
  await expect(page.getByTestId('merge-result')).toContainText('8 หน้า', { timeout: 30_000 });

  // 8. ดาวน์โหลดไฟล์
  await page.getByRole('button', { name: /ดาวน์โหลดไฟล์/ }).click();
  const outFile = join(downloadDir, 'ผลลัพธ์ทดสอบ.pdf');
  await expect.poll(() => existsSync(outFile), { timeout: 15_000 }).toBe(true);
  await expect.poll(() => readFileSync(outFile).length, { timeout: 15_000 }).toBeGreaterThan(0);

  // 9. เปิดไฟล์ที่ได้และตรวจสอบจำนวนหน้า ลำดับ ขนาด และการหมุน
  const doc = await PDFDocument.load(readFileSync(outFile));
  const pages = doc.getPages().map((p) => ({ w: Math.round(p.getWidth()), r: p.getRotation().angle }));
  expect(pages).toHaveLength(8);
  expect(pages.map((p) => p.w)).toEqual([420, 420, 420, 595, 595, 612, 612, 612]);
  expect(pages.map((p) => p.r)).toEqual([0, 0, 0, 90, 0, 0, 0, 0]);
});
