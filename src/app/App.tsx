import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ConfirmDialog, type ConfirmRequest } from '../components/ConfirmDialog';
import { ErrorMessage } from '../components/ErrorMessage';
import { FileList } from '../components/FileList';
import { Header } from '../components/Header';
import { HelpDialog } from '../components/HelpDialog';
import { OutputPanel } from '../components/OutputPanel';
import { PageGrid } from '../components/PageGrid';
import { PreviewPanel } from '../components/PreviewPanel';
import { ProgressPanel } from '../components/ProgressPanel';
import { UploadZone } from '../components/UploadZone';
import { DEFAULT_LIMITS, type AppLimits } from '../config/limits';
import { useMergeProgress } from '../hooks/useMergeProgress';
import { usePdfFiles } from '../hooks/usePdfFiles';
import { usePdfPages } from '../hooks/usePdfPages';
import { canChooseSaveLocation, saveOutput } from '../services/downloadService';
import { releaseAllDocuments } from '../services/pdfRenderer';
import { buildMergePlan, initialWorkspace, outputPages, planSignature, workspaceReducer } from '../state/workspace';
import type { PdfFileEntry } from '../types/pdf';
import { DEFAULT_OUTPUT_NAME, sanitizeFileName } from '../utils/fileName';

export function App({ limits = DEFAULT_LIMITS }: { limits?: AppLimits }) {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspace);
  const files = usePdfFiles(state, dispatch, limits);
  const pages = usePdfPages(state, dispatch);
  const merge = useMergeProgress(limits);

  const [fileName, setFileName] = useState(DEFAULT_OUTPUT_NAME);
  const [chooseLocation, setChooseLocation] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = merge.busy;
  const output = useMemo(() => outputPages(state), [state]);
  const deletedPages = useMemo(() => state.pages.filter((p) => p.deleted), [state.pages]);
  const checkingCount = state.files.filter((f) => f.status === 'checking').length;
  const errorCount = state.files.filter((f) => f.status === 'error').length;
  const readyCount = state.files.filter((f) => f.status === 'ready').length;

  const blockers = useMemo(() => {
    const list: string[] = [];
    if (state.files.length === 0) list.push('ยังไม่ได้เพิ่มไฟล์ PDF');
    else if (readyCount === 0 && checkingCount === 0) list.push('ไม่มีไฟล์ที่ใช้งานได้ กรุณาเพิ่มไฟล์ PDF ที่ถูกต้อง');
    if (checkingCount > 0) list.push('กรุณารอให้ตรวจสอบไฟล์เสร็จก่อน');
    if (readyCount > 0 && output.length === 0) list.push('ยังไม่มีหน้าที่เลือกสำหรับรวม (ติ๊กเลือกอย่างน้อย 1 หน้า)');
    return list;
  }, [state.files.length, readyCount, checkingCount, output.length]);

  const resultIsStale = merge.result ? merge.result.planSignature !== planSignature(output) : false;

  // เตือนก่อนรีเฟรชหรือปิดหน้า เพื่อไม่ให้งานที่จัดไว้หายโดยไม่ตั้งใจ
  useEffect(() => {
    if (state.files.length === 0 && !busy) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state.files.length, busy]);

  const pickFiles = useCallback(() => inputRef.current?.click(), []);

  const ask = useCallback((request: ConfirmRequest) => setConfirm(request), []);

  const resetAll = useCallback(() => {
    files.cancelImports();
    merge.clear();
    dispatch({ type: 'reset' });
    setPreviewId(null);
    setSaveMessage(null);
    setFileName(DEFAULT_OUTPUT_NAME);
    void releaseAllDocuments();
  }, [files, merge]);

  const requestReset = useCallback(() => {
    ask({
      title: 'เริ่มต้นใหม่',
      message: 'ล้างไฟล์และการจัดการหน้าทั้งหมดออกจากโปรแกรม? (ไฟล์ต้นฉบับในเครื่องไม่ได้รับผลกระทบ)',
      confirmLabel: 'เริ่มต้นใหม่',
      danger: true,
      onConfirm: resetAll,
    });
  }, [ask, resetAll]);

  const requestRemoveFile = useCallback(
    (file: PdfFileEntry) => {
      ask({
        title: 'ลบไฟล์ออกจากรายการ',
        message: `ลบไฟล์ "${file.name}" และหน้าทั้งหมดของไฟล์นี้ออกจากรายการ? (ไฟล์ต้นฉบับในเครื่องไม่ถูกลบ)`,
        confirmLabel: 'ลบไฟล์',
        danger: true,
        onConfirm: () => files.removeFile(file.id),
      });
    },
    [ask, files],
  );

  const requestDeletePages = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      ask({
        title: 'ลบหน้า',
        message: `ลบ ${ids.length} หน้าออกจากรายการ? หน้าที่ลบจะไม่ถูกนำไปรวม และกู้คืนได้ในส่วน "หน้าที่ถูกลบ"`,
        confirmLabel: `ลบ ${ids.length} หน้า`,
        danger: true,
        onConfirm: () => pages.remove(ids),
      });
    },
    [ask, pages],
  );

  const previewFile = useCallback(
    (file: PdfFileEntry) => {
      const first = pages.visible.find((p) => p.fileId === file.id);
      if (first) setPreviewId(first.id);
    },
    [pages.visible],
  );

  const startMerge = useCallback(() => {
    const name = sanitizeFileName(fileName);
    if (!name.ok || blockers.length > 0 || busy) return;
    setSaveMessage(null);
    setPreviewId(null);
    const plan = buildMergePlan(state);
    void merge.start(plan.sources, plan.items, name.name, plan.signature);
  }, [blockers.length, busy, fileName, merge, state]);

  const download = useCallback(async () => {
    if (!merge.result) return;
    const outcome = await saveOutput(merge.result.bytes, merge.result.fileName, chooseLocation);
    setSaveMessage(
      outcome === 'saved'
        ? `บันทึกไฟล์ ${merge.result.fileName} เรียบร้อยแล้ว`
        : outcome === 'downloaded'
          ? `เริ่มดาวน์โหลด ${merge.result.fileName} แล้ว (ตรวจสอบในโฟลเดอร์ดาวน์โหลดหรือตำแหน่งที่เลือก)`
          : 'ยกเลิกการบันทึกไฟล์',
    );
  }, [chooseLocation, merge.result]);

  return (
    <div className="app">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        data-testid="file-input"
        onChange={(e) => {
          if (e.target.files) files.addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <Header onPickFiles={pickFiles} onReset={requestReset} onHelp={() => setShowHelp(true)} canReset={state.files.length > 0 || !!merge.result} busy={busy} />

      <main className="layout">
        <div className="column column-left">
          <UploadZone
            onFiles={files.addFiles}
            onPickFiles={pickFiles}
            fileCount={state.files.length}
            limits={limits}
            importProgress={files.importProgress}
            disabled={busy}
          />
          {files.notices.map((n) => (
            <ErrorMessage key={n.id} message={n.message} hint={n.hint} tone="warning" onDismiss={() => files.dismissNotice(n.id)} />
          ))}
          <FileList
            files={state.files}
            pages={state.pages}
            disabled={busy}
            canRestoreOrder={!!state.fileOrderBeforeSort}
            onMoveTo={(id, toIndex) => dispatch({ type: 'fileMoved', id, toIndex })}
            onSort={(mode) => dispatch({ type: 'filesSorted', mode })}
            onRestoreOrder={() => dispatch({ type: 'fileOrderRestored' })}
            onRemove={requestRemoveFile}
            onPreview={previewFile}
            onSelectAll={(fileId, selected) =>
              pages.setSelected(pages.visible.filter((p) => p.fileId === fileId).map((p) => p.id), selected)
            }
            onRotateAll={(fileId, delta) =>
              pages.rotate(pages.visible.filter((p) => p.fileId === fileId).map((p) => p.id), delta)
            }
          />
        </div>

        <div className="column column-main">
          <PageGrid
            files={state.files}
            visiblePages={pages.visible}
            deletedPages={deletedPages}
            disabled={busy}
            onToggle={pages.toggle}
            onRotate={pages.rotate}
            onDelete={requestDeletePages}
            onRestore={pages.restore}
            onMove={pages.move}
            onShift={pages.shift}
            onOpen={setPreviewId}
            onReset={() =>
              ask({
                title: 'คืนค่าหน้าเริ่มต้น',
                message: 'ยกเลิกการเลือก การหมุน การลบ และการจัดลำดับหน้าทั้งหมด แล้วกลับเป็นค่าเริ่มต้น?',
                confirmLabel: 'คืนค่า',
                onConfirm: pages.reset,
              })
            }
            onSelection={pages.applySelection}
          />
        </div>

        <div className="column column-right">
          <ProgressPanel
            fileCount={state.files.length}
            checkingCount={checkingCount}
            errorCount={errorCount}
            totalPages={pages.visible.length}
            selectedPages={output.length}
            ready={blockers.length === 0}
            progress={merge.progress}
          />
          <OutputPanel
            fileName={fileName}
            onFileNameChange={setFileName}
            outputPageCount={output.length}
            blockers={blockers}
            busy={busy}
            progress={merge.progress}
            error={merge.error}
            result={merge.result}
            resultIsStale={resultIsStale}
            canChooseLocation={canChooseSaveLocation()}
            chooseLocation={chooseLocation}
            onChooseLocationChange={setChooseLocation}
            saveMessage={saveMessage}
            onMerge={startMerge}
            onCancel={merge.cancel}
            onDownload={download}
            onRestart={requestReset}
            onDismissError={merge.clear}
          />
        </div>
      </main>

      <footer className="app-footer">
        PDF Merger · ประมวลผลภายในเครื่อง · ไม่มีการส่งเอกสารออกไปภายนอก
      </footer>

      {previewId && (
        <PreviewPanel
          pageId={previewId}
          pages={pages.visible}
          files={state.files}
          disabled={busy}
          onNavigate={setPreviewId}
          onRotate={pages.rotate}
          onToggle={pages.toggle}
          onClose={() => setPreviewId(null)}
        />
      )}
      {showHelp && <HelpDialog onClose={() => setShowHelp(false)} />}
      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}
