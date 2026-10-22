import { Icon } from './Icon';
interface ErrorMessageProps {
  message: string;
  hint?: string | null;
  tone?: 'error' | 'warning' | 'info';
  onDismiss?: () => void;
}

/** แสดงข้อความแจ้งเตือนเป็นข้อความธรรมดา (React escape ให้อัตโนมัติ ไม่แสดง HTML จากเอกสาร) */
export function ErrorMessage({ message, hint, tone = 'error', onDismiss }: ErrorMessageProps) {
  return (
    <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <div className="alert-text">
        <strong>{message}</strong>
        {hint && <span className="alert-hint">{hint}</span>}
      </div>
      {onDismiss && (
        <button type="button" className="btn btn-ghost btn-icon" onClick={onDismiss} aria-label="ปิดข้อความ">
          <Icon name="close" />
        </button>
      )}
    </div>
  );
}
