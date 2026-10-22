import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PageItem, PdfFileEntry } from '../types/pdf';
import { PageImage } from './PageImage';

interface PageThumbnailProps {
  page: PageItem;
  file: PdfFileEntry;
  position: number;
  outputNumber: number | null;
  isFirst: boolean;
  isLast: boolean;
  disabled: boolean;
  onToggle: (id: string) => void;
  onRotate: (ids: string[], delta: number) => void;
  onDelete: (ids: string[]) => void;
  onShift: (id: string, direction: -1 | 1) => void;
  onOpen: (id: string) => void;
}

export function PageThumbnail({
  page,
  file,
  position,
  outputNumber,
  isFirst,
  isLast,
  disabled,
  onToggle,
  onRotate,
  onDelete,
  onShift,
  onOpen,
}: PageThumbnailProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id, disabled });
  const label = `${file.name} หน้าเดิม ${page.sourceIndex + 1}`;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`page-card ${page.selected ? 'is-selected' : 'is-unselected'} ${isDragging ? 'is-dragging' : ''}`}
      data-testid="page-card"
      data-page-label={label}
    >
      <div className="page-card-top">
        <label className="page-check">
          <input
            type="checkbox"
            checked={page.selected}
            onChange={() => onToggle(page.id)}
            disabled={disabled}
            aria-label={`เลือก ${label}`}
          />
          <span>{page.selected ? `ลำดับใหม่ ${outputNumber}` : 'ไม่รวม'}</span>
        </label>
        {page.rotation !== 0 && <span className="rotation-badge">↻ {page.rotation}°</span>}
      </div>

      <button
        type="button"
        className="page-thumb-button"
        onClick={() => onOpen(page.id)}
        aria-label={`ดูภาพขยาย ${label}`}
        {...attributes}
        {...listeners}
      >
        {file.bytes && (
          <PageImage
            fileId={file.id}
            bytes={file.bytes}
            pageIndex={page.sourceIndex}
            rotation={page.rotation}
            width={150}
            alt={label}
          />
        )}
      </button>

      <div className="page-caption" title={label}>
        <span className="page-position">#{position}</span>
        <span className="page-source">
          {file.name} · หน้า {page.sourceIndex + 1}
        </span>
      </div>

      <div className="page-actions">
        <button type="button" className="btn btn-xs" onClick={() => onShift(page.id, -1)} disabled={disabled || isFirst} aria-label={`ย้าย ${label} ไปด้านหน้า`} title="ย้ายไปด้านหน้า">
          ◀
        </button>
        <button type="button" className="btn btn-xs" onClick={() => onRotate([page.id], -90)} disabled={disabled} aria-label={`หมุนซ้าย ${label}`} title="หมุนซ้าย 90°">
          ↺
        </button>
        <button type="button" className="btn btn-xs" onClick={() => onRotate([page.id], 90)} disabled={disabled} aria-label={`หมุนขวา ${label}`} title="หมุนขวา 90°">
          ↻
        </button>
        <button type="button" className="btn btn-xs btn-danger-outline" onClick={() => onDelete([page.id])} disabled={disabled} aria-label={`ลบ ${label}`} title="ลบหน้า">
          🗑
        </button>
        <button type="button" className="btn btn-xs" onClick={() => onShift(page.id, 1)} disabled={disabled || isLast} aria-label={`ย้าย ${label} ไปด้านหลัง`} title="ย้ายไปด้านหลัง">
          ▶
        </button>
      </div>
    </li>
  );
}
