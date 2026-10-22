import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useMemo } from 'react';
import type { FileSortMode, PageItem, PdfFileEntry } from '../types/pdf';
import { SORT_LABELS } from '../utils/fileOrdering';
import { FileItem } from './FileItem';

interface FileListProps {
  files: PdfFileEntry[];
  pages: PageItem[];
  disabled: boolean;
  canRestoreOrder: boolean;
  onMoveTo: (id: string, toIndex: number) => void;
  onSort: (mode: FileSortMode) => void;
  onRestoreOrder: () => void;
  onRemove: (file: PdfFileEntry) => void;
  onPreview: (file: PdfFileEntry) => void;
  onSelectAll: (fileId: string, selected: boolean) => void;
  onRotateAll: (fileId: string, delta: number) => void;
}

export function FileList(props: FileListProps) {
  const { files, pages, disabled, canRestoreOrder, onMoveTo, onSort, onRestoreOrder } = props;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const counts = useMemo(() => {
    const map = new Map<string, { active: number; selected: number }>();
    for (const page of pages) {
      if (page.deleted) continue;
      const entry = map.get(page.fileId) ?? { active: 0, selected: 0 };
      entry.active += 1;
      if (page.selected) entry.selected += 1;
      map.set(page.fileId, entry);
    }
    return map;
  }, [pages]);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const toIndex = files.findIndex((f) => f.id === over.id);
    if (toIndex >= 0) onMoveTo(String(active.id), toIndex);
  };

  return (
    <section className="panel" aria-labelledby="file-panel-title">
      <div className="panel-header">
        <h2 id="file-panel-title">รายการไฟล์ ({files.length})</h2>
        <div className="panel-tools">
          <select
            aria-label="เรียงลำดับไฟล์อัตโนมัติ"
            value=""
            disabled={disabled || files.length < 2}
            onChange={(e) => e.target.value && onSort(e.target.value as FileSortMode)}
          >
            <option value="">เรียงลำดับ…</option>
            {(Object.keys(SORT_LABELS) as FileSortMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {SORT_LABELS[mode]}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-sm" onClick={onRestoreOrder} disabled={disabled || !canRestoreOrder}>
            คืนลำดับเดิม
          </button>
        </div>
      </div>

      {files.length === 0 ? (
        <p className="empty-state">ยังไม่มีไฟล์ กรุณาเพิ่มไฟล์ PDF อย่างน้อย 1 ไฟล์</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={files.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <ol className="file-list">
              {files.map((file, index) => (
                <FileItem
                  key={file.id}
                  file={file}
                  index={index}
                  total={files.length}
                  activePages={counts.get(file.id)?.active ?? 0}
                  selectedPages={counts.get(file.id)?.selected ?? 0}
                  disabled={disabled}
                  onMoveTo={onMoveTo}
                  onRemove={props.onRemove}
                  onPreview={props.onPreview}
                  onSelectAll={props.onSelectAll}
                  onRotateAll={props.onRotateAll}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}
