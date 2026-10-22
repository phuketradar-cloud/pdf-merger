import type { MergeErrorCode } from '../services/pdfMerger';

export interface UserMessage {
  message: string;
  hint: string;
}

export function mergeErrorMessage(code: MergeErrorCode, fileName?: string): UserMessage {
  const file = fileName ? ` ${fileName}` : '';
  switch (code) {
    case 'no-pages':
      return { message: 'ไม่มีหน้าที่จะนำไปรวม', hint: 'กรุณาเลือกอย่างน้อย 1 หน้า (ติ๊กช่องเลือกบนภาพหน้า) แล้วลองอีกครั้ง' };
    case 'missing-source':
      return { message: `ไม่พบข้อมูลไฟล์${file}`, hint: 'ไฟล์อาจถูกลบออกจากรายการระหว่างประมวลผล กรุณาเพิ่มไฟล์อีกครั้ง' };
    case 'invalid-page':
      return { message: `หน้าที่เลือกจากไฟล์${file} ไม่มีอยู่จริง`, hint: 'กรุณากด "คืนค่าหน้าเริ่มต้น" แล้วจัดการหน้าใหม่' };
    case 'read-failed':
      return {
        message: `ไม่สามารถเปิดไฟล์${file} ได้ เนื่องจากไฟล์อาจเสียหายหรือมีการป้องกันด้วยรหัสผ่าน`,
        hint: 'กรุณาตรวจสอบไฟล์ต้นฉบับและลองอีกครั้ง',
      };
    case 'copy-failed':
      return { message: `เกิดข้อผิดพลาดขณะคัดลอกหน้าจากไฟล์${file}`, hint: 'ไฟล์อาจมีโครงสร้างที่ไม่รองรับ ลองบันทึกไฟล์ใหม่ (Print to PDF) แล้วเพิ่มอีกครั้ง' };
    case 'save-failed':
      return { message: 'เกิดข้อผิดพลาดขณะบันทึกไฟล์ผลลัพธ์', hint: 'ลองลดจำนวนหน้าหรือแบ่งรวมเป็นหลายไฟล์ แล้วลองอีกครั้ง' };
    case 'empty-output':
      return { message: 'ไฟล์ผลลัพธ์มีขนาดเป็นศูนย์', hint: 'กรุณาลองรวมไฟล์อีกครั้ง หากยังเกิดปัญหาให้ตรวจสอบไฟล์ต้นฉบับ' };
    case 'verify-failed':
      return { message: 'ไฟล์ผลลัพธ์ไม่สามารถเปิดอ่านกลับได้', hint: 'ระบบไม่เปิดให้ดาวน์โหลดเพื่อป้องกันไฟล์เสีย กรุณาลองอีกครั้ง' };
    case 'page-count-mismatch':
      return { message: 'จำนวนหน้าในไฟล์ผลลัพธ์ไม่ตรงกับที่กำหนด', hint: 'ระบบไม่เปิดให้ดาวน์โหลดเพื่อป้องกันหน้าหาย กรุณาลองอีกครั้ง' };
    case 'cancelled':
      return { message: 'ยกเลิกการรวมไฟล์แล้ว', hint: 'รายการไฟล์และหน้ายังอยู่ครบ สามารถกดรวมไฟล์ใหม่ได้ทุกเมื่อ' };
    case 'out-of-memory':
      return {
        message: 'หน่วยความจำของเครื่องไม่เพียงพอสำหรับการรวมไฟล์ชุดนี้',
        hint: 'ลองปิดโปรแกรมอื่น ลดจำนวนไฟล์หรือจำนวนหน้า แล้วรวมเป็นหลายไฟล์ย่อย',
      };
    case 'timeout':
      return { message: 'การรวมไฟล์ใช้เวลานานเกินกำหนด', hint: 'ลองลดจำนวนไฟล์หรือจำนวนหน้า แล้วลองอีกครั้ง' };
    case 'worker-failed':
      return { message: 'ตัวประมวลผลเบื้องหลังหยุดทำงานโดยไม่คาดคิด', hint: 'อาจเกิดจากหน่วยความจำไม่พอ กรุณาลดจำนวนหน้าแล้วลองอีกครั้ง' };
    default:
      return { message: 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ', hint: 'กรุณาลองอีกครั้ง' };
  }
}
