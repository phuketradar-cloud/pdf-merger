export type SaveOutcome = 'saved' | 'downloaded' | 'cancelled';

interface SaveFilePickerWindow {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<{ createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }>;
}

export function canChooseSaveLocation(): boolean {
  return typeof window !== 'undefined' && typeof (window as SaveFilePickerWindow).showSaveFilePicker === 'function';
}

function toBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes], { type: 'application/pdf' });
}

/** ดาวน์โหลดแบบมาตรฐานของเบราว์เซอร์ผ่าน Blob URL แล้วคืนหน่วยความจำด้วย revokeObjectURL */
export function downloadBytes(bytes: Uint8Array, fileName: string): void {
  const url = URL.createObjectURL(toBlob(bytes));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * บันทึกไฟล์ผลลัพธ์
 * - chooseLocation=true และเบราว์เซอร์รองรับ: เปิดหน้าต่างเลือกตำแหน่งบันทึก
 * - กรณีอื่น: ใช้พฤติกรรมดาวน์โหลดมาตรฐาน
 */
export async function saveOutput(bytes: Uint8Array, fileName: string, chooseLocation: boolean): Promise<SaveOutcome> {
  const picker = (window as SaveFilePickerWindow).showSaveFilePicker;
  if (chooseLocation && typeof picker === 'function') {
    try {
      const handle = await picker({
        suggestedName: fileName,
        types: [{ description: 'เอกสาร PDF', accept: { 'application/pdf': ['.pdf'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(toBlob(bytes));
      await writable.close();
      return 'saved';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // เบราว์เซอร์ไม่อนุญาต ให้ใช้การดาวน์โหลดมาตรฐานแทน
    }
  }
  downloadBytes(bytes, fileName);
  return 'downloaded';
}
