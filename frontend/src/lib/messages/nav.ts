/**
 * Every Thai string the shared navbar shows, in one place (CLAUDE.md,
 * หัวข้อ 5). Brand name, catalog/wallet/logout wording and role labels
 * already live in messages/wallet.ts and messages/admin.ts - reused from
 * there rather than duplicated here.
 */
export const navMessages = {
  search: {
    placeholder: "ค้นหาคอร์สที่อยากเรียน",
    ariaLabel: "ค้นหาคอร์ส",
    loading: "กำลังค้นหา...",
    empty: "ไม่พบคอร์สที่ตรงกับคำค้นหา",
    viewAllPrefix: "ดูผลการค้นหาทั้งหมดสำหรับ",
  },

  notifications: {
    ariaLabel: "การแจ้งเตือน",
    title: "การแจ้งเตือน",
    empty: "ยังไม่มีการแจ้งเตือน",
    comingSoon: "ระบบแจ้งเตือนจะเปิดใช้งานในเวอร์ชันถัดไป",
  },

  userMenu: {
    ariaLabel: "เมนูผู้ใช้",
    instructorDashboard: "แดชบอร์ดผู้สอน",
    adminDashboard: "แผงควบคุมผู้ดูแลระบบ",
    logoutConfirm: "ยืนยันออกจากระบบ คุณจะต้องเข้าสู่ระบบใหม่อีกครั้งเพื่อใช้งานต่อ",
  },

  mobile: {
    openMenu: "เปิดเมนู",
    closeMenu: "ปิดเมนู",
  },

  /** Phone-only bar for signed-in students (BottomNav). */
  bottomNav: {
    label: "เมนูหลัก",
    home: "หน้าแรก",
    search: "ค้นหา",
    myCourses: "คอร์สของฉัน",
    wallet: "กระเป๋าเงิน",
    profile: "โปรไฟล์",
  },
} as const;
