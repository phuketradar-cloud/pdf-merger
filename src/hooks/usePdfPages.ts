import { useCallback, useMemo, type Dispatch } from 'react';
import { activePages, type WorkspaceAction, type WorkspaceState } from '../state/workspace';
import type { PageItem } from '../types/pdf';
import { evenPageNumbers, oddPageNumbers, parsePageRanges } from '../utils/pageSelection';

/** ขอบเขตของคำสั่งเลือกหน้า: 'all' = ลำดับในผลลัพธ์, หรือ fileId = หมายเลขหน้าเดิมของไฟล์นั้น */
export type SelectionScope = 'all' | string;

export type SelectionCommand =
  | { kind: 'odd' }
  | { kind: 'even' }
  | { kind: 'range'; text: string }
  | { kind: 'all' }
  | { kind: 'none' }
  | { kind: 'invert' };

/** หน้าในขอบเขต พร้อมหมายเลขที่ใช้อ้างอิง (ลำดับในผลลัพธ์ หรือ หมายเลขหน้าเดิม) */
export function pagesInScope(pages: PageItem[], scope: SelectionScope): Array<{ page: PageItem; number: number }> {
  if (scope === 'all') return pages.map((page, i) => ({ page, number: i + 1 }));
  return pages
    .filter((p) => p.fileId === scope)
    .sort((a, b) => a.sourceIndex - b.sourceIndex)
    .map((page) => ({ page, number: page.sourceIndex + 1 }));
}

export function usePdfPages(state: WorkspaceState, dispatch: Dispatch<WorkspaceAction>) {
  const visible = useMemo(() => activePages(state), [state]);

  const toggle = useCallback((id: string) => dispatch({ type: 'pageToggled', id }), [dispatch]);
  const rotate = useCallback((ids: string[], delta: number) => dispatch({ type: 'pagesRotated', ids, delta }), [dispatch]);
  const remove = useCallback((ids: string[]) => dispatch({ type: 'pagesDeleted', ids }), [dispatch]);
  const restore = useCallback((ids: string[]) => dispatch({ type: 'pagesRestored', ids }), [dispatch]);
  const move = useCallback((id: string, overId: string) => dispatch({ type: 'pageMoved', id, overId }), [dispatch]);
  const reset = useCallback(() => dispatch({ type: 'pagesReset' }), [dispatch]);
  const setSelected = useCallback(
    (ids: string[], selected: boolean) => dispatch({ type: 'pagesSelected', ids, selected }),
    [dispatch],
  );

  /** ย้ายหน้าไปด้านหน้า (-1) หรือด้านหลัง (+1) หนึ่งตำแหน่งในลำดับผลลัพธ์ */
  const shift = useCallback(
    (id: string, direction: -1 | 1) => {
      const index = visible.findIndex((p) => p.id === id);
      const neighbour = visible[index + direction];
      if (index >= 0 && neighbour) dispatch({ type: 'pageMoved', id, overId: neighbour.id });
    },
    [dispatch, visible],
  );

  /** ใช้คำสั่งเลือกหน้า คืนค่าข้อความผิดพลาด (ถ้ามี) */
  const applySelection = useCallback(
    (scope: SelectionScope, command: SelectionCommand): string | null => {
      const scoped = pagesInScope(visible, scope);
      const scopeIds = scoped.map((s) => s.page.id);
      if (scoped.length === 0) return 'ไม่มีหน้าในขอบเขตที่เลือก';

      const pickNumbers = (numbers: number[]) => {
        const wanted = new Set(numbers);
        dispatch({
          type: 'selectionReplaced',
          scopeIds,
          selectedIds: scoped.filter((s) => wanted.has(s.number)).map((s) => s.page.id),
        });
      };

      switch (command.kind) {
        case 'all':
          dispatch({ type: 'pagesSelected', ids: scopeIds, selected: true });
          return null;
        case 'none':
          dispatch({ type: 'pagesSelected', ids: scopeIds, selected: false });
          return null;
        case 'invert':
          dispatch({ type: 'selectionInverted', ids: scopeIds });
          return null;
        case 'odd':
        case 'even': {
          const max = Math.max(...scoped.map((s) => s.number));
          pickNumbers(command.kind === 'odd' ? oddPageNumbers(max) : evenPageNumbers(max));
          return null;
        }
        case 'range': {
          const max = Math.max(...scoped.map((s) => s.number));
          const parsed = parsePageRanges(command.text, max);
          if (!parsed.ok) return parsed.error;
          pickNumbers(parsed.pages);
          return null;
        }
      }
    },
    [dispatch, visible],
  );

  return { visible, toggle, rotate, remove, restore, move, shift, reset, setSelected, applySelection };
}
