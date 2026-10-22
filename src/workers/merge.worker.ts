import { MergeError, mergePdf } from '../services/pdfMerger';
import type { MergeItem, MergeProgress, MergeSource } from '../types/pdf';

export interface MergeWorkerRequest {
  sources: MergeSource[];
  items: MergeItem[];
}

export type MergeWorkerResponse =
  | { type: 'progress'; progress: MergeProgress }
  | { type: 'done'; bytes: Uint8Array; pageCount: number }
  | { type: 'error'; code: MergeError['code']; fileName?: string };

interface WorkerScope {
  onmessage: ((event: MessageEvent<MergeWorkerRequest>) => void) | null;
  postMessage(message: MergeWorkerResponse, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

// ทำงานรวมไฟล์ใน Web Worker เพื่อไม่ให้หน้าจอค้าง การยกเลิกทำโดย terminate() Worker จากฝั่งหน้าจอ
scope.onmessage = async (event) => {
  const { sources, items } = event.data;
  try {
    const result = await mergePdf(sources, items, {
      onProgress: (progress) => scope.postMessage({ type: 'progress', progress }),
    });
    scope.postMessage({ type: 'done', bytes: result.bytes, pageCount: result.pageCount }, [result.bytes.buffer]);
  } catch (error) {
    const mergeError = error instanceof MergeError ? error : new MergeError(error instanceof RangeError ? 'out-of-memory' : 'save-failed');
    scope.postMessage({ type: 'error', code: mergeError.code, fileName: mergeError.fileName });
  }
};
