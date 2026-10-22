import type { MergeProgress, MergeResult } from '../types/pdf';
import type { UserMessage } from '../utils/errorMessages';
import { sanitizeFileName } from '../utils/fileName';
import { formatBytes } from '../utils/fileSize';
import { ErrorMessage } from './ErrorMessage';

interface OutputPanelProps {
  fileName: string;
  onFileNameChange: (value: string) => void;
  outputPageCount: number;
  blockers: string[];
  busy: boolean;
  progress: MergeProgress;
  error: UserMessage | null;
  result: MergeResult | null;
  resultIsStale: boolean;
  canChooseLocation: boolean;
  chooseLocation: boolean;
  onChooseLocationChange: (value: boolean) => void;
  saveMessage: string | null;
  onMerge: () => void;
  onCancel: () => void;
  onDownload: () => void;
  onRestart: () => void;
  onDismissError: () => void;
}

export function OutputPanel(props: OutputPanelProps) {
  const { fileName, outputPageCount, blockers, busy, error, result } = props;
  const nameCheck = sanitizeFileName(fileName);
  const canMerge = blockers.length === 0 && nameCheck.ok && !busy;

  return (
    <section className="panel output-panel" aria-labelledby="output-panel-title">
      <div className="panel-header">
        <h2 id="output-panel-title">สร้างไฟล์ผลลัพธ์</h2>
      </div>

      <label className="field">
        <span>ชื่อไฟล์ผลลัพธ์</span>
        <input
          type="text"
          value={fileName}
          onChange={(e) => props.onFileNameChange(e.target.value)}
          placeholder="merged-document.pdf"
          disabled={busy}
          aria-invalid={!nameCheck.ok}
        />
      </label>
      {nameCheck.ok ? (
        nameCheck.changed && <p className="field-note">จะบันทึกเป็น: <strong>{nameCheck.name}</strong></p>
      ) : (
        <p className="field-error">{nameCheck.error}</p>
      )}

      {props.canChooseLocation && (
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={props.chooseLocation}
            onChange={(e) => props.onChooseLocationChange(e.target.checked)}
            disabled={busy}
          />
          เลือกตำแหน่งบันทึกเองเมื่อดาวน์โหลด
        </label>
      )}

      <p className="output-estimate">
        จำนวนหน้าผลลัพธ์: <strong data-testid="output-page-count">{outputPageCount}</strong> หน้า
      </p>

      {blockers.length > 0 && !busy && (
        <ul className="blockers">
          {blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}

      <div className="output-actions">
        <button type="button" className="btn btn-primary btn-lg" onClick={props.onMerge} disabled={!canMerge}>
          {busy ? (
            <>
              <span className="spinner" aria-hidden="true" /> กำลังรวมไฟล์…
            </>
          ) : result ? (
            'สร้างไฟล์ใหม่จากรายการเดิม'
          ) : (
            '⧉ รวมไฟล์ PDF'
          )}
        </button>
        {busy && (
          <button type="button" className="btn btn-danger-outline" onClick={props.onCancel}>
            ยกเลิกการประมวลผล
          </button>
        )}
      </div>

      {error && <ErrorMessage message={error.message} hint={error.hint} tone={props.progress.stage === 'cancelled' ? 'info' : 'error'} onDismiss={props.onDismissError} />}

      {result && !busy && (
        <div className="result-card" data-testid="merge-result">
          <p className="result-title">✅ รวมไฟล์สำเร็จ และตรวจสอบไฟล์ผลลัพธ์แล้ว</p>
          <dl>
            <dt>ชื่อไฟล์</dt>
            <dd>{result.fileName}</dd>
            <dt>จำนวนหน้า</dt>
            <dd>{result.pageCount} หน้า</dd>
            <dt>ขนาดไฟล์</dt>
            <dd>{formatBytes(result.size)}</dd>
          </dl>
          {props.resultIsStale && (
            <ErrorMessage
              tone="warning"
              message="รายการมีการเปลี่ยนแปลงหลังสร้างไฟล์นี้"
              hint='ไฟล์ด้านบนยังเป็นผลลัพธ์ชุดเดิม กด "สร้างไฟล์ใหม่จากรายการเดิม" เพื่อสร้างตามรายการปัจจุบัน'
            />
          )}
          <div className="output-actions">
            <button type="button" className="btn btn-success btn-lg" onClick={props.onDownload}>
              ⬇ ดาวน์โหลดไฟล์
            </button>
            <button type="button" className="btn" onClick={props.onRestart}>
              เริ่มต้นใหม่
            </button>
          </div>
          {props.saveMessage && <p className="field-note" role="status">{props.saveMessage}</p>}
        </div>
      )}
    </section>
  );
}
