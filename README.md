# PDF Merger

**รวมและจัดการเอกสาร PDF ในที่เดียว** – โปรแกรมบน Windows (.exe) และเว็บแอป ที่ประมวลผลไฟล์บนเครื่องของผู้ใช้ทั้งหมด ไม่อัปโหลดเอกสารไปที่ใด

- รวม PDF หลายไฟล์เป็นไฟล์เดียว กำหนดลำดับไฟล์และลำดับหน้าได้ (รวมถึงย้ายหน้าข้ามไฟล์)
- เลือกบางหน้า (ทีละหน้า / หน้าคี่ / หน้าคู่ / ช่วง `1-5` / รายการ `1, 3, 5-7` / กลับด้าน)
- หมุนหน้า (บันทึกลงไฟล์ผลลัพธ์จริง) ลบหน้า (กู้คืนได้) ดูภาพตัวอย่างขนาดใหญ่
- ตรวจสอบไฟล์จริงด้วย PDF Parser: ไฟล์ปลอมนามสกุล ไฟล์ว่าง ไฟล์เสีย ไฟล์ถูกตัดขาด ไฟล์มีรหัสผ่าน
- ตรวจสอบไฟล์ผลลัพธ์ (เปิดอ่านกลับ + นับจำนวนหน้า) ก่อนเปิดให้ดาวน์โหลด
- ทำงาน Offline ได้จริงในเวอร์ชัน .exe (ทุก Dependency รวมถึง pdf.js worker อยู่ในตัวโปรแกรม)

---

## ดาวน์โหลดไปใช้งาน (ผู้ใช้ทั่วไป)

ไปที่หน้า **Releases** ของ Repository นี้ แล้วดาวน์โหลด `PDF-Merger-x.y.z-portable.exe` ดับเบิลคลิกเพื่อเปิดใช้งานได้ทันที ไม่ต้องติดตั้ง

> โปรแกรมไม่ได้ Sign ด้วย Code Signing Certificate ครั้งแรกที่เปิด Windows SmartScreen อาจแสดงคำเตือน ให้กด **More info → Run anyway**

---

## ใช้งานผ่านเว็บ (GitHub Pages)

Workflow `.github/workflows/pages.yml` จะ build และ deploy เว็บอัตโนมัติทุกครั้งที่ push ไปยัง `main`
ตั้งค่าครั้งแรก: **Settings → Pages → Build and deployment → Source: GitHub Actions**
จากนั้นเว็บจะอยู่ที่ `https://<ชื่อผู้ใช้>.github.io/<ชื่อ repo>/`

เวอร์ชันเว็บประมวลผลไฟล์ในเบราว์เซอร์ของผู้ใช้เช่นกัน เอกสารไม่ถูกส่งไปที่ GitHub หรือเซิร์ฟเวอร์ใด (GitHub Pages ส่งเฉพาะไฟล์โปรแกรมให้เบราว์เซอร์)

---

## สำหรับนักพัฒนา

### 1. ติดตั้ง Node.js
ติดตั้ง Node.js เวอร์ชัน 20 ขึ้นไป (แนะนำ LTS) จาก https://nodejs.org แล้วตรวจสอบ:

```bash
node -v
```

### 2. ติดตั้ง Dependencies

```bash
npm install
```

### 3. รัน Development Server (เว็บ)

```bash
npm run dev
```
เปิด http://localhost:5173

### 4. เปิดเป็นโปรแกรม Desktop (Electron)

```bash
npm start
```

### 5. ทดสอบระบบ

```bash
npm test
```
Unit + Integration tests (Vitest + React Testing Library)

```bash
npm run build
```

```bash
npm run test:e2e
```
End-to-End test (Playwright + Electron) – ต้อง `npm run build` ก่อน

### 6. Build สำหรับใช้งานจริง

ไฟล์ .exe แบบ Portable (ไฟล์เดียว ไม่ต้องติดตั้ง) → `release/PDF-Merger-1.0.0-portable.exe`

```bash
npm run dist
```

ตัวติดตั้งแบบ Setup (NSIS) → `release/PDF-Merger-1.0.0-setup.exe`

```bash
npm run dist:installer
```

เว็บแอปสำหรับ Static Hosting (GitHub Pages, Netlify ฯลฯ) → โฟลเดอร์ `dist/`

```bash
npm run build
```

### 7. Build อัตโนมัติด้วย GitHub Actions
ไฟล์ `.github/workflows/build.yml` จะรันเทสต์และสร้าง .exe ทุกครั้งที่ push ไปยัง `main` (ดาวน์โหลดได้จากแท็บ Actions → Artifacts)
หาก push tag เช่น `v1.0.0` ระบบจะแนบไฟล์ .exe ไว้ในหน้า Releases ให้อัตโนมัติ

```bash
git tag v1.0.0
```

```bash
git push origin v1.0.0
```

---

## โครงสร้างโปรเจกต์

```
electron/main.cjs          Electron wrapper (โปรโตคอล app://, CSP, บล็อกเครือข่ายภายนอก)
src/
  app/App.tsx              ประกอบหน้าจอหลัก
  components/              UI (Header, UploadZone, FileList, FileItem, PageGrid, PageThumbnail,
                           PageImage, PreviewPanel, OutputPanel, ProgressPanel, ConfirmDialog,
                           ErrorMessage, HelpDialog, Modal)
  services/                pdfValidator, pdfLoader, pdfMerger (Core Merge Engine),
                           mergeRunner (Web Worker), pdfRenderer (pdf.js), downloadService
  workers/merge.worker.ts  รวมไฟล์ใน Web Worker (หน้าจอไม่ค้าง / ยกเลิกได้ทันที)
  state/workspace.ts       Reducer + Selectors (State เดียวกับข้อมูลที่ใช้ประมวลผลจริง)
  hooks/                   usePdfFiles, usePdfPages, useMergeProgress
  utils/                   fileName, fileSize, pageSelection, fileOrdering, rotation, errorMessages
  config/limits.ts         ขีดจำกัดที่ปรับได้
tests/
  unit/                    ตรวจไฟล์, รวม PDF, เลือกหน้า, ชื่อไฟล์, State
  integration/             ขั้นตอนเต็มผ่านหน้าจอ
  e2e/                     Playwright + Electron
```

## ขีดจำกัด (ปรับได้ที่ `src/config/limits.ts`)

| รายการ | ค่าเริ่มต้น |
|---|---|
| จำนวนไฟล์ | 100 ไฟล์ |
| ขนาดต่อไฟล์ | 200 MB |
| ขนาดรวม | 1000 MB |
| จำนวนหน้าต่อไฟล์ | 3,000 หน้า |
| จำนวนหน้ารวม | 5,000 หน้า |
| เวลาประมวลผลสูงสุด | 10 นาที |

ค่าเหล่านี้เป็นค่าที่โปรแกรมกำหนดเพื่อป้องกันเครื่องค้าง **ไม่ใช่ข้อจำกัดของรูปแบบ PDF หรือของเบราว์เซอร์** ขนาดที่ใช้ได้จริงขึ้นกับหน่วยความจำของเครื่อง

## ข้อจำกัดที่ทราบ

- **ไฟล์ที่มีรหัสผ่าน/เข้ารหัส:** ตรวจพบและแจ้งผู้ใช้ แต่ไม่ถอดรหัส (pdf-lib ไม่รองรับการถอดรหัส) ให้บันทึกสำเนาแบบไม่มีรหัสผ่านก่อน
- **คุณสมบัติที่อาจไม่ถูกเก็บรักษาในไฟล์ผลลัพธ์:** ลายเซ็นดิจิทัล (จะไม่ valid อีกต่อไป), ฟอร์มกรอกข้อมูล (AcroForm), Bookmark/Outline, Annotation/ลิงก์บางชนิด, ไฟล์แนบใน PDF, JavaScript ใน PDF, Metadata ของไฟล์ต้นฉบับ – ยังไม่ได้ทดสอบยืนยัน จึงไม่รับประกัน
- เนื้อหาหน้า (ข้อความ ภาพ ฟอนต์ที่ฝัง) ขนาดหน้ากระดาษ และแนวตั้ง/แนวนอน ถูกรักษาไว้ (ทดสอบแล้วกับไฟล์ที่สร้างจาก pdf-lib)
- เมื่อเปลี่ยนลำดับ **ไฟล์** หน้าจะถูกจัดกลุ่มใหม่ตามลำดับไฟล์ (ลำดับหน้าภายในไฟล์ การเลือก การหมุนยังคงเดิม) หากต้องการวางหน้าข้ามไฟล์ ให้จัดลำดับไฟล์ก่อนแล้วจึงย้ายหน้า
- ไม่สามารถสั่งงานเครื่องสแกนได้ ต้องสแกนเป็น PDF ก่อน
- เวอร์ชันเว็บ (`npm run dev` / Static Hosting) ต้องโหลดไฟล์โปรแกรมจากเซิร์ฟเวอร์ครั้งแรก จึงไม่ใช่ Offline เต็มรูปแบบ (เวอร์ชัน .exe เป็น Offline)
- ไฟล์ .exe ไม่ได้ Sign และใช้ไอคอนเริ่มต้นของ Electron

## ความเป็นส่วนตัวและความปลอดภัย

- ประมวลผลไฟล์ในเครื่องเท่านั้น ไม่มี Backend, Database, API Key หรือ Telemetry
- เวอร์ชัน .exe บล็อกการเชื่อมต่อเครือข่ายภายนอกทั้งหมด, ใช้ Content-Security-Policy, `contextIsolation` + `sandbox`, ปฏิเสธการขอสิทธิ์ทุกชนิด
- ไม่บันทึกเนื้อหาเอกสารลง Local/Session Storage และไม่แสดงใน Console
- pdf.js ตั้งค่า `isEvalSupported: false`, ไม่มีการใช้ `eval` หรือแสดง HTML จากเนื้อหาเอกสาร
- กด "เริ่มต้นใหม่" เพื่อล้างข้อมูลในหน่วยความจำ

ระบบนี้ไม่ได้อ้างว่าปลอดภัยสมบูรณ์ ขอบเขตด้านบนคือสิ่งที่ออกแบบและทดสอบไว้

## แก้ปัญหาที่พบบ่อย

| ปัญหา | วิธีแก้ |
|---|---|
| `npm run dist` error เรื่อง *Cannot create symbolic link* | ตั้งค่าไว้แล้ว (`signAndEditExecutable: false`) หากยังเกิด ให้เปิด Windows Developer Mode |
| `npm run dist` error *could not open file ... .nsh* | Path ของโฟลเดอร์ยาวเกิน 260 ตัวอักษร ให้ย้ายโปรเจกต์ไปไว้ใน path สั้น ๆ เช่น `C:\dev\pdf-merger` |
| ภาพตัวอย่างไม่แสดง | ไฟล์อาจใช้ฟอนต์พิเศษ ให้รัน `npm run build` ใหม่ (สคริปต์จะคัดลอก cMaps/standard fonts ของ pdf.js) |
| SmartScreen เตือนตอนเปิด .exe | เป็นเพราะไม่ได้ Sign โปรแกรม กด More info → Run anyway |
| ไฟล์ขึ้นว่า "มีการป้องกันด้วยรหัสผ่าน" | เปิดไฟล์ด้วยโปรแกรมอ่าน PDF แล้ว Print to PDF เป็นไฟล์ใหม่ |
| หน่วยความจำไม่พอ | ลดจำนวนไฟล์/หน้า แล้วรวมเป็นหลายชุด |

## License

MIT
