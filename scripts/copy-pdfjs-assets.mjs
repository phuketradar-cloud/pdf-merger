// คัดลอก cMaps และ standard fonts ของ pdf.js มาไว้ใน public/pdfjs
// เพื่อให้แสดงตัวอย่างหน้าได้โดยไม่ต้องโหลดจากอินเทอร์เน็ต (รองรับ Offline ในไฟล์ .exe)
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', 'pdfjs-dist');
const target = join(root, 'public', 'pdfjs');

if (!existsSync(source)) {
  console.error('ไม่พบ node_modules/pdfjs-dist กรุณารัน npm install ก่อน');
  process.exit(1);
}

mkdirSync(target, { recursive: true });
for (const dir of ['cmaps', 'standard_fonts']) {
  cpSync(join(source, dir), join(target, dir), { recursive: true });
}
console.log('คัดลอกไฟล์ pdf.js (cmaps, standard_fonts) ไปที่ public/pdfjs แล้ว');
