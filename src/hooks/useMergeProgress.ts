import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppLimits } from '../config/limits';
import { runMerge, type MergeJob } from '../services/mergeRunner';
import { MergeError } from '../services/pdfMerger';
import type { MergeItem, MergeProgress, MergeResult, MergeSource } from '../types/pdf';
import { mergeErrorMessage, type UserMessage } from '../utils/errorMessages';

export interface MergeState {
  progress: MergeProgress;
  error: UserMessage | null;
  result: MergeResult | null;
}

const IDLE: MergeProgress = { stage: 'idle', done: 0, total: 0 };

export function isBusy(progress: MergeProgress): boolean {
  return ['preparing', 'reading', 'copying', 'saving', 'verifying'].includes(progress.stage);
}

export function useMergeProgress(limits: AppLimits) {
  const [state, setState] = useState<MergeState>({ progress: IDLE, error: null, result: null });
  const jobRef = useRef<MergeJob | null>(null);

  const start = useCallback(
    async (sources: MergeSource[], items: MergeItem[], fileName: string, signature: string) => {
      // ป้องกันการประมวลผลซ้ำจากการกดปุ่มหลายครั้ง
      if (jobRef.current) return;
      setState({ progress: { stage: 'preparing', done: 0, total: items.length }, error: null, result: null });

      // สร้าง job ไว้ก่อน เพราะ onProgress อาจถูกเรียกทันทีระหว่าง runMerge
      const job: MergeJob = { promise: Promise.resolve({ bytes: new Uint8Array(), pageCount: 0 }), cancel: () => undefined };
      jobRef.current = job;
      const running = runMerge(sources, items, {
        timeoutMs: limits.mergeTimeoutMs,
        onProgress: (progress) => {
          if (jobRef.current === job && progress.stage !== 'done') {
            setState((s) => ({ ...s, progress }));
          }
        },
      });
      job.promise = running.promise;
      job.cancel = running.cancel;

      try {
        const output = await job.promise;
        if (jobRef.current !== job) return;
        setState({
          progress: { stage: 'done', done: output.pageCount, total: output.pageCount },
          error: null,
          result: {
            ...output,
            fileName,
            size: output.bytes.byteLength,
            planSignature: signature,
            createdAt: Date.now(),
          },
        });
      } catch (error) {
        if (jobRef.current !== job) return;
        const code = error instanceof MergeError ? error.code : 'save-failed';
        const fileNameInError = error instanceof MergeError ? error.fileName : undefined;
        if (import.meta.env.DEV) {
          // บันทึกเฉพาะรหัสข้อผิดพลาดเพื่อ Debug ไม่บันทึกเนื้อหาเอกสาร
          console.debug('[merge] failed with code', code);
        }
        setState({
          progress: { stage: code === 'cancelled' ? 'cancelled' : 'error', done: 0, total: items.length },
          error: mergeErrorMessage(code, fileNameInError),
          result: null,
        });
      } finally {
        if (jobRef.current === job) jobRef.current = null;
      }
    },
    [limits.mergeTimeoutMs],
  );

  const cancel = useCallback(() => {
    jobRef.current?.cancel();
  }, []);

  const clear = useCallback(() => {
    jobRef.current?.cancel();
    jobRef.current = null;
    setState({ progress: IDLE, error: null, result: null });
  }, []);

  useEffect(() => () => jobRef.current?.cancel(), []);

  return { ...state, busy: isBusy(state.progress), start, cancel, clear };
}
