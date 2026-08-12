/**
 * Site-wide copy that does not belong to any one domain: the 404 page and
 * the error boundaries Next.js renders when a route or the whole app throws
 * (CLAUDE.md, หัวข้อ 5 — ข้อความไทยรวมไว้ที่เดียว ไม่กระจายเป็น string ลอย).
 */
export const commonMessages = {
  notFound: {
    title: "ไม่พบหน้าที่คุณต้องการ",
    body: "หน้านี้อาจถูกย้ายหรือไม่มีอยู่จริง ลองตรวจสอบลิงก์อีกครั้งหรือกลับไปหน้าแรก",
    backHome: "กลับไปหน้าแรก",
  },

  error: {
    title: "เกิดข้อผิดพลาดบางอย่าง",
    body: "ระบบไม่สามารถแสดงหน้านี้ได้ในตอนนี้ กรุณาลองใหม่อีกครั้ง",
    retry: "ลองใหม่อีกครั้ง",
    backHome: "กลับไปหน้าแรก",
  },
} as const;
