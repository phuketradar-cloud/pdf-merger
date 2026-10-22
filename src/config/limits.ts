/**
 * ขีดจำกัดของโปรแกรม – เป็นค่าที่โปรแกรมนี้กำหนดเองเพื่อป้องกันเครื่องค้างหรือหน่วยความจำไม่พอ
 * ไม่ใช่ข้อจำกัดสากลของรูปแบบ PDF หรือของเบราว์เซอร์ สามารถปรับค่าได้ตามสเปกเครื่องที่ใช้งาน
 */
export interface AppLimits {
  maxFiles: number;
  maxFileSizeBytes: number;
  maxTotalSizeBytes: number;
  maxPagesPerFile: number;
  maxTotalPages: number;
  mergeTimeoutMs: number;
}

const MB = 1024 * 1024;

export const DEFAULT_LIMITS: AppLimits = {
  maxFiles: 100,
  maxFileSizeBytes: 200 * MB,
  maxTotalSizeBytes: 1000 * MB,
  maxPagesPerFile: 3000,
  maxTotalPages: 5000,
  mergeTimeoutMs: 10 * 60 * 1000,
};
