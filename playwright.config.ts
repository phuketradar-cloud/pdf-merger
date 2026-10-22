import { defineConfig } from '@playwright/test';

// E2E ทดสอบโปรแกรมจริงผ่าน Electron (ต้องรัน npm run build ก่อน)
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
});
