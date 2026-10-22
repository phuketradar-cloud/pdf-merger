import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base: './' ทำให้ไฟล์ที่ build แล้วเปิดได้ทั้งบน Static Hosting และภายใน Electron (.exe)
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30000,
  },
});
