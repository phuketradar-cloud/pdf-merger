import { useCallback, useRef, useState, type Dispatch } from 'react';
import type { AppLimits } from '../config/limits';
import { loadPdfFile } from '../services/pdfLoader';
import { releaseDocument } from '../services/pdfRenderer';
import type { WorkspaceAction, WorkspaceState } from '../state/workspace';
import { formatBytes } from '../utils/fileSize';
import { createId } from '../utils/id';

export interface ImportProgress {
  done: number;
  total: number;
}

export interface ImportNotice {
  id: string;
  message: string;
  hint: string;
}

/** จัดการการนำเข้าไฟล์: เพิ่มตามลำดับที่ได้รับ ตรวจสอบทีละไฟล์ และแสดงความคืบหน้า */
export function usePdfFiles(state: WorkspaceState, dispatch: Dispatch<WorkspaceAction>, limits: AppLimits) {
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [notices, setNotices] = useState<ImportNotice[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const generationRef = useRef(0);

  const addNotice = useCallback((message: string, hint: string) => {
    setNotices((list) => [...list, { id: createId('notice'), message, hint }]);
  }, []);

  const dismissNotice = useCallback((id: string) => {
    setNotices((list) => list.filter((n) => n.id !== id));
  }, []);

  const addFiles = useCallback(
    (input: FileList | File[]) => {
      const incoming = Array.from(input);
      if (incoming.length === 0) {
        addNotice('ยังไม่ได้เลือกไฟล์', 'กรุณาเลือกหรือลากไฟล์ PDF มาวาง');
        return;
      }

      const current = stateRef.current.files;
      const room = limits.maxFiles - current.length;
      if (room <= 0) {
        addNotice(`เพิ่มไฟล์ได้สูงสุด ${limits.maxFiles} ไฟล์`, 'กรุณาลบไฟล์ที่ไม่ใช้ออกก่อน หรือรวมเป็นหลายชุด');
        return;
      }
      let accepted = incoming.slice(0, room);
      if (accepted.length < incoming.length) {
        addNotice(
          `เพิ่มได้เพียง ${accepted.length} จาก ${incoming.length} ไฟล์ เนื่องจากเกินจำนวนไฟล์สูงสุด (${limits.maxFiles} ไฟล์)`,
          'กรุณาแบ่งเป็นหลายชุด',
        );
      }

      let totalSize = current.reduce((sum, f) => sum + f.size, 0);
      const withinSize: File[] = [];
      for (const file of accepted) {
        if (totalSize + file.size > limits.maxTotalSizeBytes) {
          addNotice(
            `ไม่ได้เพิ่มไฟล์ ${file.name} เพราะขนาดรวมจะเกิน ${formatBytes(limits.maxTotalSizeBytes)}`,
            'กรุณาลบไฟล์บางส่วนหรือรวมเป็นหลายชุด',
          );
          continue;
        }
        totalSize += file.size;
        withinSize.push(file);
      }
      accepted = withinSize;
      if (accepted.length === 0) return;

      const pending = accepted.map((file) => ({ id: createId('file'), name: file.name, size: file.size, file }));
      dispatch({ type: 'filesAdded', files: pending.map(({ id, name, size }) => ({ id, name, size })) });
      setImportProgress((p) => ({ done: p?.done ?? 0, total: (p?.total ?? 0) + pending.length }));

      const generation = generationRef.current;
      // ตรวจสอบทีละไฟล์ตามลำดับที่ได้รับ เพื่อลดการใช้หน่วยความจำพร้อมกัน
      queueRef.current = queueRef.current.then(async () => {
        let totalPages = stateRef.current.files.reduce((sum, f) => sum + f.pageCount, 0);
        for (const item of pending) {
          if (generation !== generationRef.current) return; // ผู้ใช้กดเริ่มต้นใหม่แล้ว
          const stillListed = stateRef.current.files.some((f) => f.id === item.id);
          if (stillListed) {
            const { validation, bytes } = await loadPdfFile(item.file, limits);
            if (generation !== generationRef.current) return;
            if (validation.ok && bytes) {
              if (totalPages + validation.pageCount > limits.maxTotalPages) {
                dispatch({
                  type: 'fileFailed',
                  id: item.id,
                  error: `เพิ่มไฟล์ ${item.name} ไม่ได้ เพราะจำนวนหน้ารวมจะเกิน ${limits.maxTotalPages.toLocaleString('th-TH')} หน้า`,
                  hint: 'กรุณาลบไฟล์นี้ออก หรือรวมเป็นหลายชุด',
                });
              } else {
                totalPages += validation.pageCount;
                dispatch({
                  type: 'fileValidated',
                  id: item.id,
                  bytes,
                  pageCount: validation.pageCount,
                  pageInfos: validation.pageInfos,
                  warning: validation.warning,
                });
              }
            } else if (!validation.ok) {
              dispatch({ type: 'fileFailed', id: item.id, error: validation.message, hint: validation.hint });
            }
          }
          setImportProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
        }
        setImportProgress((p) => (p && p.done >= p.total ? null : p));
      });
    },
    [addNotice, dispatch, limits],
  );

  const removeFile = useCallback(
    (id: string) => {
      dispatch({ type: 'fileRemoved', id });
      void releaseDocument(id);
    },
    [dispatch],
  );

  const cancelImports = useCallback(() => {
    generationRef.current += 1;
    queueRef.current = Promise.resolve();
    setImportProgress(null);
    setNotices([]);
  }, []);

  return { addFiles, removeFile, importProgress, notices, addNotice, dismissNotice, cancelImports };
}
