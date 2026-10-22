import type { MergeProgress, MergeStage } from '../types/pdf';

interface ProgressPanelProps {
  fileCount: number;
  checkingCount: number;
  errorCount: number;
  totalPages: number;
  selectedPages: number;
  ready: boolean;
  progress: MergeProgress;
}

const STEPS: Array<{ stage: MergeStage; label: string }> = [
  { stage: 'preparing', label: 'ตรวจสอบข้อมูล' },
  { stage: 'reading', label: 'อ่านไฟล์ต้นฉบับ' },
  { stage: 'copying', label: 'คัดลอกและเรียงหน้า' },
  { stage: 'saving', label: 'บันทึกไฟล์ PDF' },
  { stage: 'verifying', label: 'ตรวจสอบไฟล์ผลลัพธ์' },
];

function overallStatus(props: ProgressPanelProps): { text: string; tone: string } {
  const { stage } = props.progress;
  if (stage === 'done') return { text: 'สำเร็จ – พร้อมดาวน์โหลด', tone: 'success' };
  if (stage === 'error') return { text: 'ไม่สำเร็จ', tone: 'error' };
  if (stage === 'cancelled') return { text: 'ยกเลิกแล้ว', tone: 'muted' };
  if (stage !== 'idle') return { text: 'กำลังประมวลผล…', tone: 'busy' };
  if (props.checkingCount > 0) return { text: 'กำลังตรวจสอบไฟล์…', tone: 'busy' };
  if (props.ready) return { text: 'พร้อมรวมไฟล์', tone: 'success' };
  return { text: 'ยังไม่พร้อม', tone: 'muted' };
}

export function ProgressPanel(props: ProgressPanelProps) {
  const { progress } = props;
  const status = overallStatus(props);
  const activeIndex = STEPS.findIndex((s) => s.stage === progress.stage);
  const running = activeIndex >= 0;

  return (
    <section className="panel status-panel" aria-labelledby="status-panel-title">
      <div className="panel-header">
        <h2 id="status-panel-title">สถานะ</h2>
        <span className={`status-pill status-pill-${status.tone}`} role="status" data-testid="overall-status">
          {status.text}
        </span>
      </div>
      <dl className="stats">
        <div>
          <dt>ไฟล์ที่เพิ่ม</dt>
          <dd>{props.fileCount}</dd>
        </div>
        <div>
          <dt>หน้ารวม</dt>
          <dd data-testid="total-pages">{props.totalPages}</dd>
        </div>
        <div>
          <dt>หน้าที่เลือก</dt>
          <dd data-testid="selected-pages">{props.selectedPages}</dd>
        </div>
        <div>
          <dt>ไฟล์ที่มีปัญหา</dt>
          <dd className={props.errorCount ? 'text-error' : ''}>{props.errorCount}</dd>
        </div>
      </dl>

      {running && (
        <ol className="steps" aria-label="ขั้นตอนการรวมไฟล์">
          {STEPS.map((step, i) => (
            <li key={step.stage} className={i < activeIndex ? 'step-done' : i === activeIndex ? 'step-active' : ''}>
              {i < activeIndex ? '✓' : i === activeIndex ? '●' : '○'} {step.label}
              {i === activeIndex && step.stage === 'copying' && progress.total > 0 && (
                <> ({progress.done}/{progress.total} หน้า)</>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
