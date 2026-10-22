import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useMemo, useState } from 'react';
import type { SelectionCommand, SelectionScope } from '../hooks/usePdfPages';
import type { PageItem, PdfFileEntry } from '../types/pdf';
import { ErrorMessage } from './ErrorMessage';
import { PageThumbnail } from './PageThumbnail';

interface PageGridProps {
  files: PdfFileEntry[];
  visiblePages: PageItem[];
  deletedPages: PageItem[];
  disabled: boolean;
  onToggle: (id: string) => void;
  onRotate: (ids: string[], delta: number) => void;
  onDelete: (ids: string[]) => void;
  onRestore: (ids: string[]) => void;
  onMove: (id: string, overId: string) => void;
  onShift: (id: string, direction: -1 | 1) => void;
  onOpen: (id: string) => void;
  onReset: () => void;
  onSelection: (scope: SelectionScope, command: SelectionCommand) => string | null;
}

export function PageGrid(props: PageGridProps) {
  const { files, visiblePages, deletedPages, disabled } = props;
  const [scope, setScope] = useState<SelectionScope>('all');
  const [rangeText, setRangeText] = useState('');
  const [rangeError, setRangeError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const fileMap = useMemo(() => new Map(files.map((f) => [f.id, f])), [files]);
  const readyFiles = files.filter((f) => f.status === 'ready');
  const selectedIds = visiblePages.filter((p) => p.selected).map((p) => p.id);
  const effectiveScope = scope !== 'all' && !fileMap.has(scope) ? 'all' : scope;

  const outputNumbers = useMemo(() => {
    const map = new Map<string, number>();
    let n = 0;
    for (const page of visiblePages) if (page.selected) map.set(page.id, ++n);
    return map;
  }, [visiblePages]);

  const run = (command: SelectionCommand) => {
    setRangeError(props.onSelection(effectiveScope, command));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) props.onMove(String(active.id), String(over.id));
  };

  return (
    <section className="panel page-panel" aria-labelledby="page-panel-title">
      <div className="panel-header">
        <h2 id="page-panel-title">จัดการหน้าเอกสาร</h2>
        <span className="panel-count">
          แสดง {visiblePages.length} หน้า · เลือก {selectedIds.length} หน้า
        </span>
      </div>

      {visiblePages.length === 0 && deletedPages.length === 0 ? (
        <p className="empty-state">เมื่อเพิ่มไฟล์ PDF แล้ว ภาพตัวอย่างของทุกหน้าจะแสดงที่นี่</p>
      ) : (
        <>
          <div className="toolbar" role="toolbar" aria-label="คำสั่งจัดการหน้าที่เลือก">
            <button type="button" className="btn btn-sm" onClick={() => props.onRotate(selectedIds, -90)} disabled={disabled || !selectedIds.length}>
              ↺ หมุนซ้ายหน้าที่เลือก
            </button>
            <button type="button" className="btn btn-sm" onClick={() => props.onRotate(selectedIds, 90)} disabled={disabled || !selectedIds.length}>
              ↻ หมุนขวาหน้าที่เลือก
            </button>
            <button type="button" className="btn btn-sm btn-danger-outline" onClick={() => props.onDelete(selectedIds)} disabled={disabled || !selectedIds.length}>
              🗑 ลบหน้าที่เลือก
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={props.onReset} disabled={disabled}>
              คืนค่าหน้าเริ่มต้น
            </button>
          </div>

          <div className="toolbar selection-toolbar" role="group" aria-label="คำสั่งเลือกหน้า">
            <label className="inline-field">
              ขอบเขต
              <select value={effectiveScope} onChange={(e) => setScope(e.target.value)} disabled={disabled}>
                <option value="all">ทุกไฟล์ (ใช้ลำดับ # ปัจจุบัน)</option>
                {readyFiles.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} (ใช้หมายเลขหน้าเดิม)
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-sm" onClick={() => run({ kind: 'all' })} disabled={disabled}>
              เลือกทั้งหมด
            </button>
            <button type="button" className="btn btn-sm" onClick={() => run({ kind: 'none' })} disabled={disabled}>
              ไม่เลือกทั้งหมด
            </button>
            <button type="button" className="btn btn-sm" onClick={() => run({ kind: 'invert' })} disabled={disabled}>
              กลับด้านการเลือก
            </button>
            <button type="button" className="btn btn-sm" onClick={() => run({ kind: 'odd' })} disabled={disabled}>
              หน้าคี่
            </button>
            <button type="button" className="btn btn-sm" onClick={() => run({ kind: 'even' })} disabled={disabled}>
              หน้าคู่
            </button>
            <form
              className="range-form"
              onSubmit={(e) => {
                e.preventDefault();
                run({ kind: 'range', text: rangeText });
              }}
            >
              <input
                type="text"
                value={rangeText}
                onChange={(e) => setRangeText(e.target.value)}
                placeholder="เช่น 1-5 หรือ 1, 3, 5-7"
                aria-label="ช่วงหน้าที่ต้องการเลือก"
                disabled={disabled}
              />
              <button type="submit" className="btn btn-sm btn-primary" disabled={disabled}>
                เลือกตามช่วง
              </button>
            </form>
          </div>
          {rangeError && <ErrorMessage message={rangeError} tone="warning" onDismiss={() => setRangeError(null)} />}

          <p className="hint-text">
            ช่องติ๊ก = นำหน้านั้นไปรวม · #ลำดับ = ตำแหน่งในรายการ · "ลำดับใหม่" = หมายเลขหน้าในไฟล์ผลลัพธ์ · ลากภาพเพื่อจัดลำดับข้ามไฟล์ได้
          </p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={visiblePages.map((p) => p.id)} strategy={rectSortingStrategy}>
              <ol className="page-grid">
                {visiblePages.map((page, i) => {
                  const file = fileMap.get(page.fileId);
                  if (!file) return null;
                  return (
                    <PageThumbnail
                      key={page.id}
                      page={page}
                      file={file}
                      position={i + 1}
                      outputNumber={outputNumbers.get(page.id) ?? null}
                      isFirst={i === 0}
                      isLast={i === visiblePages.length - 1}
                      disabled={disabled}
                      onToggle={props.onToggle}
                      onRotate={props.onRotate}
                      onDelete={props.onDelete}
                      onShift={props.onShift}
                      onOpen={props.onOpen}
                    />
                  );
                })}
              </ol>
            </SortableContext>
          </DndContext>

          {deletedPages.length > 0 && (
            <div className="deleted-tray" aria-label="หน้าที่ถูกลบ">
              <div className="deleted-header">
                <strong>หน้าที่ถูกลบ ({deletedPages.length})</strong>
                <span className="muted">ไม่ถูกนำไปรวม และไม่กระทบไฟล์ต้นฉบับในเครื่อง</span>
                <button type="button" className="btn btn-sm" onClick={() => props.onRestore(deletedPages.map((p) => p.id))} disabled={disabled}>
                  กู้คืนทั้งหมด
                </button>
              </div>
              <ul className="deleted-list">
                {deletedPages.map((page) => (
                  <li key={page.id}>
                    <span>
                      {fileMap.get(page.fileId)?.name} · หน้า {page.sourceIndex + 1}
                    </span>
                    <button type="button" className="btn btn-xs" onClick={() => props.onRestore([page.id])} disabled={disabled}>
                      กู้คืน
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
