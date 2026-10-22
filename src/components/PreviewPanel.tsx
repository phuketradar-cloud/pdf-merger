import { useEffect } from 'react';
import type { PageItem, PdfFileEntry } from '../types/pdf';
import { pointsToMm } from '../utils/fileSize';
import { normalizeRotation } from '../utils/rotation';
import { Modal } from './Modal';
import { PageImage } from './PageImage';
import { Icon } from './Icon';

interface PreviewPanelProps {
  pageId: string;
  pages: PageItem[];
  files: PdfFileEntry[];
  disabled: boolean;
  onNavigate: (pageId: string) => void;
  onRotate: (ids: string[], delta: number) => void;
  onToggle: (id: string) => void;
  onClose: () => void;
}

export function PreviewPanel({ pageId, pages, files, disabled, onNavigate, onRotate, onToggle, onClose }: PreviewPanelProps) {
  const index = pages.findIndex((p) => p.id === pageId);
  const page = pages[index];
  const file = page ? files.find((f) => f.id === page.fileId) : undefined;

  useEffect(() => {
    if (!page || !file) onClose();
  }, [page, file, onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && pages[index - 1]) onNavigate(pages[index - 1].id);
      if (event.key === 'ArrowRight' && pages[index + 1]) onNavigate(pages[index + 1].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, pages, onNavigate]);

  if (!page || !file || !file.bytes) return null;

  const info = file.pageInfos[page.sourceIndex];
  const finalRotation = normalizeRotation((info?.rotation ?? 0) + page.rotation);
  const swapped = finalRotation === 90 || finalRotation === 270;
  const outputNumber = page.selected ? pages.slice(0, index + 1).filter((p) => p.selected).length : null;

  return (
    <Modal title={`ตัวอย่างหน้า: ${file.name} หน้าเดิม ${page.sourceIndex + 1}`} onClose={onClose} wide>
      <div className="preview-layout">
        <div className="preview-image">
          <PageImage
            key={`${page.id}-${page.rotation}`}
            fileId={file.id}
            bytes={file.bytes}
            pageIndex={page.sourceIndex}
            rotation={page.rotation}
            width={720}
            alt={`${file.name} หน้า ${page.sourceIndex + 1}`}
            lazy={false}
          />
        </div>
        <aside className="preview-info">
          <dl>
            <dt>ไฟล์ต้นทาง</dt>
            <dd>{file.name}</dd>
            <dt>หมายเลขหน้าเดิม</dt>
            <dd>
              {page.sourceIndex + 1} จาก {file.pageCount}
            </dd>
            <dt>ตำแหน่งในรายการ</dt>
            <dd>
              #{index + 1} จาก {pages.length}
            </dd>
            <dt>หมายเลขหน้าในผลลัพธ์</dt>
            <dd>{outputNumber ?? 'ไม่ถูกนำไปรวม'}</dd>
            {info && (
              <>
                <dt>ขนาดหน้า (หลังหมุน)</dt>
                <dd>
                  {pointsToMm(swapped ? info.height : info.width)} × {pointsToMm(swapped ? info.width : info.height)} มม.
                </dd>
              </>
            )}
            <dt>มุมที่หมุนเพิ่ม</dt>
            <dd>{page.rotation}°</dd>
          </dl>
          <div className="preview-actions">
            <label className="page-check">
              <input type="checkbox" checked={page.selected} onChange={() => onToggle(page.id)} disabled={disabled} />
              นำหน้านี้ไปรวม
            </label>
            <button type="button" className="btn btn-sm" onClick={() => onRotate([page.id], -90)} disabled={disabled}>
              <Icon name="rotateLeft" /> หมุนซ้าย
            </button>
            <button type="button" className="btn btn-sm" onClick={() => onRotate([page.id], 90)} disabled={disabled}>
              <Icon name="rotateRight" /> หมุนขวา
            </button>
          </div>
          <div className="preview-nav">
            <button type="button" className="btn" onClick={() => onNavigate(pages[index - 1].id)} disabled={index === 0}>
              <Icon name="left" /> ก่อนหน้า
            </button>
            <button type="button" className="btn" onClick={() => onNavigate(pages[index + 1].id)} disabled={index === pages.length - 1}>
              ถัดไป <Icon name="right" />
            </button>
          </div>
        </aside>
      </div>
    </Modal>
  );
}
