import type { MergeItem, MergeOutput, MergeProgress, MergeSource } from '../types/pdf';
import type { MergeWorkerResponse } from '../workers/merge.worker';
import { MergeError, mergePdf } from './pdfMerger';

export interface MergeJob {
  promise: Promise<MergeOutput>;
  cancel: () => void;
}

export interface RunMergeOptions {
  onProgress: (progress: MergeProgress) => void;
  timeoutMs: number;
}

/**
 * เริ่มงานรวมไฟล์ – ใช้ Web Worker เมื่อเบราว์เซอร์รองรับ (หน้าจอไม่ค้าง และยกเลิกได้ทันที)
 * หากไม่รองรับ จะทำงานบน Main Thread และยกเลิกได้ระหว่างขั้นตอน
 */
export function runMerge(sources: MergeSource[], items: MergeItem[], options: RunMergeOptions): MergeJob {
  if (typeof Worker === 'undefined') {
    return runOnMainThread(sources, items, options);
  }

  let worker: Worker;
  try {
    worker = new Worker(new URL('../workers/merge.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return runOnMainThread(sources, items, options);
  }

  let settled = false;
  let rejectJob: (error: MergeError) => void = () => undefined;

  const promise = new Promise<MergeOutput>((resolve, reject) => {
    rejectJob = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      reject(error);
    };

    const timer = setTimeout(() => rejectJob(new MergeError('timeout')), options.timeoutMs);

    worker.onmessage = (event: MessageEvent<MergeWorkerResponse>) => {
      const message = event.data;
      if (message.type === 'progress') {
        if (!settled) options.onProgress(message.progress);
      } else if (message.type === 'done') {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        worker.terminate();
        resolve({ bytes: message.bytes, pageCount: message.pageCount });
      } else {
        rejectJob(new MergeError(message.code, message.fileName));
      }
    };
    worker.onerror = (event) => {
      event.preventDefault();
      rejectJob(new MergeError('worker-failed'));
    };

    // postMessage จะคัดลอกข้อมูลไปยัง Worker ไฟล์ต้นฉบับในหน้าจอจึงไม่ได้รับผลกระทบ
    worker.postMessage({ sources, items });
  });

  return { promise, cancel: () => rejectJob(new MergeError('cancelled')) };
}

function runOnMainThread(sources: MergeSource[], items: MergeItem[], options: RunMergeOptions): MergeJob {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), options.timeoutMs);
  const promise = mergePdf(sources, items, { signal: controller.signal, onProgress: options.onProgress })
    .catch((error: unknown) => {
      if (error instanceof MergeError && error.code === 'cancelled' && controller.signal.reason === 'timeout') {
        throw new MergeError('timeout');
      }
      throw error;
    })
    .finally(() => clearTimeout(timer));
  return { promise, cancel: () => controller.abort('cancelled') };
}
