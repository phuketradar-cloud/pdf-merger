import { Icon } from './Icon';

interface HeaderProps {
  onPickFiles: () => void;
  onReset: () => void;
  onHelp: () => void;
  canReset: boolean;
  busy: boolean;
}

export function Header({ onPickFiles, onReset, onHelp, canReset, busy }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="brand">
        <img src="./favicon.svg" alt="" className="brand-logo" />
        <div>
          <h1>PDF Merger</h1>
          <p className="brand-subtitle">รวมและจัดการเอกสาร PDF ในที่เดียว</p>
        </div>
      </div>
      <div className="privacy-badge" title="ไฟล์ถูกประมวลผลภายในเครื่องนี้เท่านั้น ไม่มีการอัปโหลดไปยังเซิร์ฟเวอร์ใด">
        <Icon name="shield" /> ประมวลผลบนเครื่องของคุณ ไม่อัปโหลดไฟล์
      </div>
      <nav className="header-actions" aria-label="คำสั่งหลัก">
        <button type="button" className="btn btn-primary" onClick={onPickFiles} disabled={busy}>
          <Icon name="plus" /> เลือกไฟล์
        </button>
        <button type="button" className="btn" onClick={onReset} disabled={!canReset || busy}>
          <Icon name="reset" /> เริ่มต้นใหม่
        </button>
        <button type="button" className="btn" onClick={onHelp}>
          <Icon name="help" /> คู่มือใช้งาน
        </button>
      </nav>
    </header>
  );
}
