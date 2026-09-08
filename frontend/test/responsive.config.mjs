/**
 * What the responsive check looks at, and how strictly.
 *
 * ทก.01 ข้อ 2.3.4 asks the interface to work "ตั้งแต่หน้าจอขนาดโทรศัพท์มือถือ
 * แท็บเล็ต จนถึงคอมพิวเตอร์ตั้งโต๊ะ". These three widths are that sentence
 * turned into numbers.
 */
export const WIDTHS = [375, 768, 1440];

/** Minimum height for anything meant to be tapped, in CSS pixels. */
export const MIN_TOUCH_HEIGHT = 36;

/** Seeded accounts. Development only — see backend/prisma/seed.ts. */
export const ACCOUNTS = {
  student: { id: 'teerapat@getownly.local', password: 'Password@1234' },
  instructor: { id: 'thanakrit@getownly.local', password: 'Password@1234' },
  admin: { id: 'admin@getownly.local', password: 'Admin@1234' },
};

/**
 * Header, sidebar and footer links repeat on every page, so a finding about
 * one of them would be reported dozens of times over. They are excluded by
 * label; a real problem with the chrome shows up as an overflow instead.
 */
export const CHROME_LABELS = [
  'getownly',
  'คอร์สเรียนทั้งหมด',
  'support@getownly.example',
  'ภาพรวม',
  'ตรวจสลิปเติมเงิน',
  'อนุมัติคอร์ส',
  'จัดการผู้ใช้',
  'หมวดหมู่',
  'รายการที่ถูกแจ้ง',
  'รายงาน',
  'กล่องคำถาม',
  'รายงานยอดขาย',
  'สร้างคอร์สใหม่',
  'กระเป๋าเงิน',
  'โปรไฟล์ของฉัน',
  'กลับไปหน้าเว็บหลัก',
];
