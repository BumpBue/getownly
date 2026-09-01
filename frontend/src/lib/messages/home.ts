/**
 * Every Thai string the post-login landing page (/home) shows, in one place
 * (CLAUDE.md, หัวข้อ 5). Components must not hold loose Thai literals.
 */
export const homeMessages = {
  greeting: {
    morning: "สวัสดีตอนเช้า",
    afternoon: "สวัสดีตอนบ่าย",
    evening: "สวัสดีตอนเย็น",
    night: "สวัสดีตอนดึก",
  },
  subtitle: "วันนี้อยากทำอะไรต่อ",
  loading: "กำลังโหลดหน้าหลัก...",
  errorTitle: "โหลดข้อมูลไม่สำเร็จ",

  actions: {
    myCourses: "คอร์สของฉัน",
    myCoursesCount: "คอร์ส",
    myCoursesLatestProgress: "ความคืบหน้าล่าสุด",
    myCoursesEmpty: "ยังไม่มีคอร์สที่ซื้อ",
    browseCourses: "เรียกดูคอร์สทั้งหมด",
    browseCoursesHint: "ค้นหาคอร์สใหม่ที่น่าสนใจ",
    editProfile: "แก้ไขโปรไฟล์",
    editProfileHint: "ปรับรูปและข้อมูลส่วนตัว",
    instructorDashboard: "แดชบอร์ดผู้สอน",
    instructorTodaySales: "ยอดขายวันนี้",
    instructorNoSalesToday: "วันนี้ยังไม่มียอดขาย",
    adminDashboard: "แผงควบคุมผู้ดูแลระบบ",
    adminPending: "รายการรออนุมัติ",
    adminAllClear: "ไม่มีรายการค้าง",
  },

  continueLearning: {
    inProgress: "กำลังเรียน",
    heading: "เรียนต่อ",
    resume: "เรียนต่อ",
  },

  emptyState: {
    title: "ยังไม่มีคอร์สที่เริ่มเรียน",
    body: "เลือกคอร์สที่สนใจแล้วเริ่มเรียนได้ทันที",
    cta: "ไปเลือกคอร์สเรียน",
  },

  pendingQuestions: {
    prefix: "มีคำถามรอตอบ",
    suffix: "ข้อ",
    cta: "ไปตอบคำถาม",
  },

  adminPendingBanner: {
    prefix: "มีรายการรออนุมัติ",
    suffix: "รายการ",
    cta: "ไปดำเนินการ",
  },

  featured: {
    heading: "คอร์สแนะนำสำหรับคุณ",
  },
} as const;
