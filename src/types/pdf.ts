export type Rotation = 0 | 90 | 180 | 270;

export type FileStatus = 'checking' | 'ready' | 'error';

/** ขนาดและมุมหมุนเดิมของหน้าในไฟล์ต้นฉบับ (หน่วย point, 1 pt = 1/72 นิ้ว) */
export interface PageInfo {
  width: number;
  height: number;
  rotation: Rotation;
}

export interface PdfFileEntry {
  /** Unique ID – ไม่ใช้ชื่อไฟล์เป็น identity เพราะชื่อไฟล์อาจซ้ำกันได้ */
  id: string;
  name: string;
  size: number;
  /** ลำดับที่ผู้ใช้เพิ่มไฟล์เข้ามา */
  addedOrder: number;
  status: FileStatus;
  /** ข้อมูลไบต์ของไฟล์ (อยู่ในหน่วยความจำเท่านั้น ไม่บันทึกลง Storage) */
  bytes: Uint8Array | null;
  pageCount: number;
  pageInfos: PageInfo[];
  error: string | null;
  errorHint: string | null;
  warning: string | null;
}

export interface PageItem {
  /** Unique ID ของรายการหน้า */
  id: string;
  fileId: string;
  /** ตำแหน่งหน้าเดิมในไฟล์ต้นฉบับ (เริ่มที่ 0) */
  sourceIndex: number;
  /** มุมที่ผู้ใช้หมุนเพิ่มจากมุมเดิมของหน้า */
  rotation: Rotation;
  /** true = นำหน้านี้ไปรวมในผลลัพธ์ */
  selected: boolean;
  /** true = ถูกลบออกจากรายการ (ยังกู้คืนได้ก่อนสร้างผลลัพธ์) */
  deleted: boolean;
}

export type FileSortMode = 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc' | 'pages-asc' | 'pages-desc';

export type MergeStage =
  | 'idle'
  | 'preparing'
  | 'reading'
  | 'copying'
  | 'saving'
  | 'verifying'
  | 'done'
  | 'error'
  | 'cancelled';

export interface MergeSource {
  fileId: string;
  fileName: string;
  bytes: Uint8Array;
}

export interface MergeItem {
  fileId: string;
  sourceIndex: number;
  rotation: Rotation;
}

export interface MergeProgress {
  stage: MergeStage;
  done: number;
  total: number;
}

export interface MergeOutput {
  bytes: Uint8Array;
  pageCount: number;
}

export interface MergeResult extends MergeOutput {
  fileName: string;
  size: number;
  planSignature: string;
  createdAt: number;
}
