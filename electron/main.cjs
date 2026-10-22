// Electron wrapper: เปิดเว็บแอป (โฟลเดอร์ dist) เป็นโปรแกรมบน Windows แบบ Offline
// ไฟล์ทั้งหมดถูกเสิร์ฟจากภายในโปรแกรมผ่านโปรโตคอล app:// ไม่มีการเชื่อมต่ออินเทอร์เน็ต
const { app, BrowserWindow, protocol, shell, session, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const SCHEME = 'app';
const HOST = 'pdf-merger';
const DIST = path.join(__dirname, '..', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.bcmap': 'application/octet-stream',
  '.pfb': 'application/octet-stream',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-src 'none'",
].join('; ');

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

// อนุญาตให้เปิดได้เพียงหน้าต่างเดียว
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

async function serveFile(request) {
  const url = new URL(request.url);
  if (url.host !== HOST) return new Response('Not found', { status: 404 });
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  const filePath = path.normalize(path.join(DIST, relative));
  // ป้องกันการอ่านไฟล์นอกโฟลเดอร์ dist (path traversal)
  if (!filePath.startsWith(DIST + path.sep)) return new Response('Forbidden', { status: 403 });
  try {
    const data = await fs.readFile(filePath);
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    return new Response(data, {
      headers: {
        'Content-Type': type,
        'Content-Security-Policy': CSP,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 380,
    minHeight: 500,
    title: 'PDF Merger',
    backgroundColor: '#f3f5f9',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  // ไม่อนุญาตให้นำทางออกไปยังเว็บไซต์ภายนอกภายในโปรแกรม
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${SCHEME}://${HOST}/`)) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // เตือนก่อนปิดหน้าต่างเมื่อมีงานค้าง (หน้าเว็บส่ง beforeunload มา)
  win.webContents.on('will-prevent-unload', (event) => {
    const { dialog } = require('electron');
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      buttons: ['ปิดโปรแกรม', 'ยกเลิก'],
      defaultId: 1,
      cancelId: 1,
      title: 'ยืนยันการปิดโปรแกรม',
      message: 'มีไฟล์ที่กำลังจัดการอยู่ หากปิดโปรแกรม รายการทั้งหมดจะหายไป',
      detail: 'ไฟล์ต้นฉบับในเครื่องไม่ได้รับผลกระทบ',
    });
    if (choice === 0) event.preventDefault();
  });

  win.loadURL(`${SCHEME}://${HOST}/index.html`);
}

app.on('second-instance', () => {
  const [win] = BrowserWindow.getAllWindows();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle(SCHEME, serveFile);

  // ปฏิเสธการขอสิทธิ์ทุกชนิด (กล้อง ไมโครโฟน ตำแหน่ง ฯลฯ) ที่โปรแกรมไม่จำเป็นต้องใช้
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  // บล็อกการเชื่อมต่อเครือข่ายภายนอกทั้งหมด เอกสารจึงไม่ถูกส่งออกไปไหน
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const allowed = /^(app|blob|data|devtools|chrome-extension):/.test(details.url);
    callback({ cancel: !allowed });
  });

  // สำหรับ E2E Test เท่านั้น: บันทึกไฟล์ลงโฟลเดอร์ที่กำหนดโดยไม่เปิดหน้าต่าง Save
  // (ใช้งานปกติจะแสดงหน้าต่างให้ผู้ใช้เลือกตำแหน่งบันทึกเสมอ)
  const testDownloadDir = process.env.PDF_MERGER_TEST_DOWNLOAD_DIR;
  if (testDownloadDir) {
    session.defaultSession.on('will-download', (_event, item) => {
      item.setSavePath(path.join(testDownloadDir, item.getFilename()));
    });
  }

  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
