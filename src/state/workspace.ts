import type { FileSortMode, MergeItem, MergeSource, PageInfo, PageItem, PdfFileEntry } from '../types/pdf';
import { moveItem, sortFiles } from '../utils/fileOrdering';
import { createId } from '../utils/id';
import { addRotation } from '../utils/rotation';

export interface WorkspaceState {
  /** รายการไฟล์ตามลำดับที่จะรวม */
  files: PdfFileEntry[];
  /** รายการหน้าตามลำดับในเอกสารผลลัพธ์ (รวมหน้าที่ถูกลบ ซึ่งมี deleted=true) */
  pages: PageItem[];
  /** ลำดับไฟล์ก่อนใช้การเรียงอัตโนมัติ (ใช้คืนลำดับเดิม) */
  fileOrderBeforeSort: string[] | null;
  nextAddedOrder: number;
}

export const initialWorkspace: WorkspaceState = {
  files: [],
  pages: [],
  fileOrderBeforeSort: null,
  nextAddedOrder: 0,
};

export interface PendingFile {
  id: string;
  name: string;
  size: number;
}

export type WorkspaceAction =
  | { type: 'filesAdded'; files: PendingFile[] }
  | { type: 'fileValidated'; id: string; bytes: Uint8Array; pageCount: number; pageInfos: PageInfo[]; warning: string | null }
  | { type: 'fileFailed'; id: string; error: string; hint: string }
  | { type: 'fileRemoved'; id: string }
  | { type: 'fileMoved'; id: string; toIndex: number }
  | { type: 'filesSorted'; mode: FileSortMode }
  | { type: 'fileOrderRestored' }
  | { type: 'pageToggled'; id: string }
  | { type: 'pagesSelected'; ids: string[]; selected: boolean }
  | { type: 'selectionReplaced'; scopeIds: string[]; selectedIds: string[] }
  | { type: 'selectionInverted'; ids: string[] }
  | { type: 'pagesRotated'; ids: string[]; delta: number }
  | { type: 'pagesDeleted'; ids: string[] }
  | { type: 'pagesRestored'; ids: string[] }
  | { type: 'pageMoved'; id: string; overId: string }
  | { type: 'pagesReset' }
  | { type: 'reset' };

function createPagesForFile(file: PdfFileEntry): PageItem[] {
  return Array.from({ length: file.pageCount }, (_, sourceIndex) => ({
    id: createId('page'),
    fileId: file.id,
    sourceIndex,
    rotation: 0,
    selected: true,
    deleted: false,
  }));
}

/**
 * จัดกลุ่มหน้าตามลำดับไฟล์ใหม่ โดยรักษาลำดับหน้าภายในไฟล์เดียวกัน
 * รวมถึงสถานะการเลือก การหมุน และการลบของแต่ละหน้า
 */
export function regroupPages(pages: PageItem[], files: PdfFileEntry[]): PageItem[] {
  const byFile = new Map<string, PageItem[]>();
  for (const page of pages) {
    const list = byFile.get(page.fileId);
    if (list) list.push(page);
    else byFile.set(page.fileId, [page]);
  }
  return files.flatMap((file) => byFile.get(file.id) ?? []);
}

function updatePages(pages: PageItem[], ids: string[], update: (page: PageItem) => PageItem): PageItem[] {
  const idSet = new Set(ids);
  return pages.map((page) => (idSet.has(page.id) ? update(page) : page));
}

function withFiles(state: WorkspaceState, files: PdfFileEntry[]): WorkspaceState {
  return { ...state, files, pages: regroupPages(state.pages, files) };
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'filesAdded': {
      let order = state.nextAddedOrder;
      const added: PdfFileEntry[] = action.files.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        addedOrder: order++,
        status: 'checking',
        bytes: null,
        pageCount: 0,
        pageInfos: [],
        error: null,
        errorHint: null,
        warning: null,
      }));
      return { ...state, files: [...state.files, ...added], nextAddedOrder: order };
    }

    case 'fileValidated': {
      const target = state.files.find((f) => f.id === action.id);
      if (!target) return state; // ผู้ใช้ลบไฟล์ไปแล้วระหว่างตรวจสอบ
      const updated: PdfFileEntry = {
        ...target,
        status: 'ready',
        bytes: action.bytes,
        pageCount: action.pageCount,
        pageInfos: action.pageInfos,
        warning: action.warning,
      };
      const files = state.files.map((f) => (f.id === action.id ? updated : f));
      return { ...state, files, pages: regroupPages([...state.pages, ...createPagesForFile(updated)], files) };
    }

    case 'fileFailed': {
      const files = state.files.map((f) =>
        f.id === action.id ? { ...f, status: 'error' as const, bytes: null, error: action.error, errorHint: action.hint } : f,
      );
      return { ...state, files };
    }

    case 'fileRemoved': {
      const files = state.files.filter((f) => f.id !== action.id);
      return {
        ...state,
        files,
        pages: state.pages.filter((p) => p.fileId !== action.id),
        fileOrderBeforeSort: state.fileOrderBeforeSort?.filter((id) => id !== action.id) ?? null,
      };
    }

    case 'fileMoved': {
      const from = state.files.findIndex((f) => f.id === action.id);
      if (from < 0) return state;
      return withFiles(state, moveItem(state.files, from, action.toIndex));
    }

    case 'filesSorted': {
      const before = state.fileOrderBeforeSort ?? state.files.map((f) => f.id);
      return { ...withFiles(state, sortFiles(state.files, action.mode)), fileOrderBeforeSort: before };
    }

    case 'fileOrderRestored': {
      if (!state.fileOrderBeforeSort) return state;
      const position = new Map(state.fileOrderBeforeSort.map((id, i) => [id, i]));
      const files = [...state.files].sort((a, b) => {
        const pa = position.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const pb = position.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        return pa - pb || a.addedOrder - b.addedOrder;
      });
      return { ...withFiles(state, files), fileOrderBeforeSort: null };
    }

    case 'pageToggled':
      return { ...state, pages: updatePages(state.pages, [action.id], (p) => ({ ...p, selected: !p.selected })) };

    case 'pagesSelected':
      return { ...state, pages: updatePages(state.pages, action.ids, (p) => ({ ...p, selected: action.selected })) };

    case 'selectionReplaced': {
      const chosen = new Set(action.selectedIds);
      return { ...state, pages: updatePages(state.pages, action.scopeIds, (p) => ({ ...p, selected: chosen.has(p.id) })) };
    }

    case 'selectionInverted':
      return { ...state, pages: updatePages(state.pages, action.ids, (p) => ({ ...p, selected: !p.selected })) };

    case 'pagesRotated':
      return {
        ...state,
        pages: updatePages(state.pages, action.ids, (p) => ({ ...p, rotation: addRotation(p.rotation, action.delta) })),
      };

    case 'pagesDeleted':
      return { ...state, pages: updatePages(state.pages, action.ids, (p) => ({ ...p, deleted: true })) };

    case 'pagesRestored':
      return { ...state, pages: updatePages(state.pages, action.ids, (p) => ({ ...p, deleted: false })) };

    case 'pageMoved': {
      const from = state.pages.findIndex((p) => p.id === action.id);
      const to = state.pages.findIndex((p) => p.id === action.overId);
      if (from < 0 || to < 0) return state;
      return { ...state, pages: moveItem(state.pages, from, to) };
    }

    case 'pagesReset':
      return {
        ...state,
        pages: state.files.filter((f) => f.status === 'ready').flatMap(createPagesForFile),
      };

    case 'reset':
      return { ...initialWorkspace, nextAddedOrder: state.nextAddedOrder };
  }
}

/* ---------- Selectors ---------- */

export function activePages(state: WorkspaceState): PageItem[] {
  return state.pages.filter((p) => !p.deleted);
}

export function outputPages(state: WorkspaceState): PageItem[] {
  const ready = new Set(state.files.filter((f) => f.status === 'ready').map((f) => f.id));
  return state.pages.filter((p) => !p.deleted && p.selected && ready.has(p.fileId));
}

/** สร้างแผนการรวมไฟล์จาก State ปัจจุบัน – เป็นข้อมูลชุดเดียวกับที่ใช้ประมวลผลจริง */
export function buildMergePlan(state: WorkspaceState): { sources: MergeSource[]; items: MergeItem[]; signature: string } {
  const pages = outputPages(state);
  const usedFiles = new Set(pages.map((p) => p.fileId));
  const sources: MergeSource[] = state.files
    .filter((f) => usedFiles.has(f.id) && f.bytes)
    .map((f) => ({ fileId: f.id, fileName: f.name, bytes: f.bytes as Uint8Array }));
  const items: MergeItem[] = pages.map((p) => ({ fileId: p.fileId, sourceIndex: p.sourceIndex, rotation: p.rotation }));
  return { sources, items, signature: planSignature(pages) };
}

export function planSignature(pages: PageItem[]): string {
  return pages.map((p) => `${p.id}@${p.rotation}`).join('|');
}
