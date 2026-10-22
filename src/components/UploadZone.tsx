import { useState, type DragEvent } from 'react';
import type { AppLimits } from '../config/limits';
import type { ImportProgress } from '../hooks/usePdfFiles';
import { formatBytes } from '../utils/fileSize';

interface UploadZoneProps {
  onFiles: (files: FileList | File[]) => void;
  onPickFiles: () => void;
  fileCount: number;
  limits: AppLimits;
  importProgress: ImportProgress | null;
  disabled: boolean;
}

export function UploadZone({ onFiles, onPickFiles, fileCount, limits, importProgress, disabled }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);

  const onDragOver = (event: DragEvent) => {
    if (disabled || !event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDragging(true);
  };

  const onDrop = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    setDragging(false);
    if (!disabled) onFiles(event.dataTransfer.files);
  };

  return (
    <section
      className={`upload-zone ${dragging ? 'is-dragging' : ''} ${fileCount > 0 ? 'is-compact' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      aria-label="พื้นที่เพิ่มไฟล์ PDF"
      data-testid="upload-zone"
    >
      <div className="upload-icon" aria-hidden="true">
        📄
      </div>
      <p className="upload-title">ลากไฟล์ PDF มาวางที่นี่</p>
      <p className="upload-sub">หรือ</p>
      <button type="button" className="btn btn-primary" onClick={onPickFiles} disabled={disabled}>
        เลือกไฟล์จากเครื่อง
      </button>
      <p className="upload-meta">
        รองรับเฉพาะไฟล์ PDF · เลือกได้หลายไฟล์พร้อมกัน · เพิ่มแล้ว <strong>{fileCount}</strong> ไฟล์
      </p>
      <p className="upload-meta muted">
        ขีดจำกัดที่โปรแกรมกำหนด: ไม่เกิน {limits.maxFiles} ไฟล์ · {formatBytes(limits.maxFileSizeBytes)} ต่อไฟล์ · รวม{' '}
        {formatBytes(limits.maxTotalSizeBytes)} · {limits.maxTotalPages.toLocaleString('th-TH')} หน้า
      </p>
      {importProgress && (
        <div className="import-progress" role="status">
          <span className="spinner" aria-hidden="true" />
          กำลังตรวจสอบไฟล์ {importProgress.done} / {importProgress.total}
          <progress value={importProgress.done} max={importProgress.total} />
        </div>
      )}
    </section>
  );
}
