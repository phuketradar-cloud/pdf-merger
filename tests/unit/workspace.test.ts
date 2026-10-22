import { describe, expect, it } from 'vitest';
import {
  activePages,
  buildMergePlan,
  initialWorkspace,
  outputPages,
  workspaceReducer,
  type WorkspaceAction,
  type WorkspaceState,
} from '../../src/state/workspace';

function apply(state: WorkspaceState, ...actions: WorkspaceAction[]) {
  return actions.reduce(workspaceReducer, state);
}

function withFiles(): WorkspaceState {
  const info = { width: 100, height: 100, rotation: 0 as const };
  return apply(
    initialWorkspace,
    {
      type: 'filesAdded',
      files: [
        { id: 'A', name: 'A.pdf', size: 300 },
        { id: 'B', name: 'B.pdf', size: 100 },
        { id: 'C', name: 'C.pdf', size: 200 },
      ],
    },
    { type: 'fileValidated', id: 'A', bytes: new Uint8Array([1]), pageCount: 2, pageInfos: [info, info], warning: null },
    { type: 'fileValidated', id: 'B', bytes: new Uint8Array([2]), pageCount: 5, pageInfos: Array(5).fill(info), warning: null },
    { type: 'fileValidated', id: 'C', bytes: new Uint8Array([3]), pageCount: 3, pageInfos: Array(3).fill(info), warning: null },
  );
}

const order = (s: WorkspaceState) => activePages(s).map((p) => `${p.fileId}${p.sourceIndex + 1}`);

describe('workspaceReducer', () => {
  it('สร้างหน้าตามลำดับไฟล์: A1–2 → B1–5 → C1–3', () => {
    const s = withFiles();
    expect(order(s)).toEqual(['A1', 'A2', 'B1', 'B2', 'B3', 'B4', 'B5', 'C1', 'C2', 'C3']);
    expect(outputPages(s)).toHaveLength(10);
  });

  it('เปลี่ยนลำดับไฟล์เป็น C → A → B แล้วหน้าเปลี่ยนตามทันที', () => {
    let s = withFiles();
    s = apply(s, { type: 'fileMoved', id: 'C', toIndex: 0 });
    expect(s.files.map((f) => f.id)).toEqual(['C', 'A', 'B']);
    expect(order(s)).toEqual(['C1', 'C2', 'C3', 'A1', 'A2', 'B1', 'B2', 'B3', 'B4', 'B5']);
  });

  it('รักษาสถานะการเลือกและการหมุนเมื่อเปลี่ยนลำดับไฟล์', () => {
    let s = withFiles();
    const b2 = s.pages[3].id;
    s = apply(s, { type: 'pageToggled', id: b2 }, { type: 'pagesRotated', ids: [b2], delta: 90 }, { type: 'fileMoved', id: 'B', toIndex: 2 });
    const moved = s.pages.find((p) => p.id === b2)!;
    expect(moved.selected).toBe(false);
    expect(moved.rotation).toBe(90);
  });

  it('เรียงอัตโนมัติและคืนลำดับเดิม', () => {
    let s = withFiles();
    s = apply(s, { type: 'filesSorted', mode: 'size-asc' });
    expect(s.files.map((f) => f.id)).toEqual(['B', 'C', 'A']);
    s = apply(s, { type: 'filesSorted', mode: 'pages-desc' });
    expect(s.files.map((f) => f.id)).toEqual(['B', 'C', 'A']);
    s = apply(s, { type: 'fileOrderRestored' });
    expect(s.files.map((f) => f.id)).toEqual(['A', 'B', 'C']);
    expect(s.fileOrderBeforeSort).toBeNull();
  });

  it('ลบหน้าหลายหน้า อัปเดตจำนวนหน้า และกู้คืนได้', () => {
    let s = withFiles();
    const ids = [s.pages[0].id, s.pages[5].id];
    s = apply(s, { type: 'pagesDeleted', ids });
    expect(activePages(s)).toHaveLength(8);
    expect(outputPages(s)).toHaveLength(8);
    s = apply(s, { type: 'pagesRestored', ids: [ids[0]] });
    expect(activePages(s)).toHaveLength(9);
  });

  it('ย้ายหน้าข้ามไฟล์ และแผนรวมไฟล์ตรงกับ State', () => {
    let s = withFiles();
    const c3 = s.pages[9].id;
    const a1 = s.pages[0].id;
    s = apply(s, { type: 'pageMoved', id: c3, overId: a1 });
    expect(order(s)[0]).toBe('C3');
    const plan = buildMergePlan(s);
    expect(plan.items[0]).toEqual({ fileId: 'C', sourceIndex: 2, rotation: 0 });
    expect(plan.items).toHaveLength(10);
    expect(plan.sources.map((x) => x.fileId).sort()).toEqual(['A', 'B', 'C']);
  });

  it('แผนรวมไฟล์รวมเฉพาะหน้าที่เลือกและไม่ถูกลบ', () => {
    let s = withFiles();
    const bIds = s.pages.filter((p) => p.fileId === 'B').map((p) => p.id);
    s = apply(s, { type: 'pagesSelected', ids: bIds, selected: false }, { type: 'pagesDeleted', ids: [s.pages[0].id] });
    const plan = buildMergePlan(s);
    expect(plan.items.map((i) => `${i.fileId}${i.sourceIndex + 1}`)).toEqual(['A2', 'C1', 'C2', 'C3']);
    expect(plan.sources.map((x) => x.fileId)).toEqual(['A', 'C']);
  });

  it('เลือกแบบแทนที่และกลับด้านการเลือก', () => {
    let s = withFiles();
    const all = s.pages.map((p) => p.id);
    s = apply(s, { type: 'selectionReplaced', scopeIds: all, selectedIds: [all[0], all[2]] });
    expect(outputPages(s).map((p) => p.id)).toEqual([all[0], all[2]]);
    s = apply(s, { type: 'selectionInverted', ids: all });
    expect(outputPages(s)).toHaveLength(8);
  });

  it('ลบไฟล์ระหว่างแก้ไข ไม่กระทบไฟล์อื่น', () => {
    let s = withFiles();
    s = apply(s, { type: 'fileRemoved', id: 'B' });
    expect(s.files.map((f) => f.id)).toEqual(['A', 'C']);
    expect(order(s)).toEqual(['A1', 'A2', 'C1', 'C2', 'C3']);
  });

  it('ไฟล์ที่ผ่านการตรวจหลังถูกลบแล้วจะไม่ถูกเพิ่มกลับ', () => {
    let s = apply(initialWorkspace, { type: 'filesAdded', files: [{ id: 'X', name: 'X.pdf', size: 1 }] });
    s = apply(s, { type: 'fileRemoved', id: 'X' });
    s = apply(s, { type: 'fileValidated', id: 'X', bytes: new Uint8Array(), pageCount: 1, pageInfos: [], warning: null });
    expect(s.files).toHaveLength(0);
    expect(s.pages).toHaveLength(0);
  });

  it('ไฟล์มีปัญหาไม่ทำให้ไฟล์อื่นหาย และไม่มีหน้าในผลลัพธ์', () => {
    let s = withFiles();
    s = apply(s, { type: 'filesAdded', files: [{ id: 'E', name: 'E.pdf', size: 5 }] });
    s = apply(s, { type: 'fileFailed', id: 'E', error: 'เสีย', hint: 'ลองใหม่' });
    expect(s.files).toHaveLength(4);
    expect(outputPages(s)).toHaveLength(10);
  });

  it('คืนค่าหน้าเริ่มต้นและเริ่มต้นใหม่', () => {
    let s = withFiles();
    s = apply(s, { type: 'pagesDeleted', ids: [s.pages[0].id] }, { type: 'pagesRotated', ids: [s.pages[1].id], delta: -90 });
    s = apply(s, { type: 'pagesReset' });
    expect(activePages(s)).toHaveLength(10);
    expect(s.pages.every((p) => p.rotation === 0 && p.selected)).toBe(true);
    s = apply(s, { type: 'reset' });
    expect(s.files).toHaveLength(0);
    expect(s.pages).toHaveLength(0);
  });
});
