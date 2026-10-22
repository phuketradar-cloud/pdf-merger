import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import type { PdfFileEntry } from '../types/pdf';
import { formatBytes } from '../utils/fileSize';
import { Icon } from './Icon';

interface FileItemProps {
  file: PdfFileEntry;
  index: number;
  total: number;
  selectedPages: number;
  activePages: number;
  disabled: boolean;
  onMoveTo: (id: string, toIndex: number) => void;
  onRemove: (file: PdfFileEntry) => void;
  onPreview: (file: PdfFileEntry) => void;
  onSelectAll: (fileId: string, selected: boolean) => void;
  onRotateAll: (fileId: string, delta: number) => void;
}

const STATUS_LABEL = {
  checking: 'กำลังตรวจสอบ…',
  ready: 'พร้อมใช้งาน',
  error: 'มีปัญหา',
} as const;

export function FileItem({
  file,
  index,
  total,
  selectedPages,
  activePages,
  disabled,
  onMoveTo,
  onRemove,
  onPreview,
  onSelectAll,
  onRotateAll,
}: FileItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: file.id,
    disabled,
  });
  const [position, setPosition] = useState('');
  const ready = file.status === 'ready';

  const submitPosition = () => {
    const target = Number(position);
    if (Number.isInteger(target) && target >= 1 && target <= total) onMoveTo(file.id, target - 1);
    setPosition('');
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`file-item status-${file.status} ${isDragging ? 'is-dragging' : ''}`}
      data-testid="file-item"
      aria-label={`ไฟล์ลำดับที่ ${index + 1}: ${file.name}`}
    >
      <div className="file-row">
        <button
          type="button"
          className="drag-handle"
          aria-label={`ลากเพื่อจัดลำดับไฟล์ ${file.name}`}
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <Icon name="grip" />
        </button>
        <span className="file-order">{index + 1}</span>
        <div className="file-info">
          <span className="file-name" title={file.name}>
            {file.name}
          </span>
          <span className="file-meta">
            {formatBytes(file.size)}
            {ready && <> · {file.pageCount} หน้า · ใช้ {selectedPages}/{activePages} หน้า</>}
            {' · '}
            <span className={`status-pill status-pill-${file.status}`}>{STATUS_LABEL[file.status]}</span>
          </span>
        </div>
      </div>

      {file.status === 'error' && (
        <div className="file-error" role="alert">
          <strong>{file.error}</strong>
          {file.errorHint && <span>{file.errorHint}</span>}
        </div>
      )}
      {file.warning && <div className="file-warning">{file.warning}</div>}

      <div className="file-actions">
        <button type="button" className="btn btn-sm" onClick={() => onMoveTo(file.id, index - 1)} disabled={disabled || index === 0}>
          <Icon name="up" /> ขึ้น
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => onMoveTo(file.id, index + 1)}
          disabled={disabled || index === total - 1}
        >
          <Icon name="down" /> ลง
        </button>
        <form
          className="move-to"
          onSubmit={(e) => {
            e.preventDefault();
            submitPosition();
          }}
        >
          <input
            type="number"
            min={1}
            max={total}
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="ลำดับ"
            aria-label={`ย้ายไฟล์ ${file.name} ไปยังลำดับที่`}
            disabled={disabled || total < 2}
          />
          <button type="submit" className="btn btn-sm" disabled={disabled || !position}>
            ย้าย
          </button>
        </form>
        <button type="button" className="btn btn-sm" onClick={() => onPreview(file)} disabled={!ready}>
          <Icon name="eye" /> ดูตัวอย่าง
        </button>
        <button type="button" className="btn btn-sm btn-danger-outline" onClick={() => onRemove(file)} disabled={disabled}>
          <Icon name="trash" /> ลบไฟล์
        </button>
      </div>

      {ready && (
        <div className="file-actions file-page-actions">
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => onSelectAll(file.id, true)} disabled={disabled}>
            เลือกทุกหน้า
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => onSelectAll(file.id, false)} disabled={disabled}>
            ไม่เลือกทุกหน้า
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => onRotateAll(file.id, -90)} disabled={disabled}>
            <Icon name="rotateLeft" /> หมุนทั้งไฟล์
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => onRotateAll(file.id, 90)} disabled={disabled}>
            <Icon name="rotateRight" /> หมุนทั้งไฟล์
          </button>
        </div>
      )}
    </li>
  );
}
