/**
 * Every Thai string the auth screens show, in one place per domain
 * (CLAUDE.md, หัวข้อ 5). Components must not hold loose Thai literals.
 */
export const authMessages = {
  brand: {
    name: "getownly",
    tagline: "ตลาดกลางคอร์สเรียนออนไลน์",
    pitchTitle: "เรียนรู้ทักษะใหม่ จากผู้สอนตัวจริง",
    pitchBody:
      "รวมคอร์สเรียนออนไลน์คุณภาพจากผู้สอนหลากหลายสาขา ซื้อครั้งเดียวเรียนได้ตลอด พร้อมแบบทดสอบและใบประกาศนียบัตรเมื่อเรียนจบ",
    points: [
      "ชำระเงินผ่าน PromptPay สะดวกและตรวจสอบได้",
      "เรียนซ้ำได้ไม่จำกัด ติดตามความคืบหน้าได้ตลอด",
      "ถามผู้สอนได้โดยตรงในทุกบทเรียน",
    ],
  },

  /** Labels for the show/hide control on every password field. */
  passwordToggle: {
    show: "แสดงรหัสผ่าน",
    hide: "ซ่อนรหัสผ่าน",
  },

  login: {
    title: "เข้าสู่ระบบ",
    subtitle: "ยินดีต้อนรับกลับ กรุณากรอกข้อมูลเพื่อเข้าใช้งาน",
    identifier: "อีเมลหรือชื่อผู้ใช้",
    identifierPlaceholder: "you@example.com",
    password: "รหัสผ่าน",
    passwordPlaceholder: "กรอกรหัสผ่านของคุณ",
    submit: "เข้าสู่ระบบ",
    submitting: "กำลังเข้าสู่ระบบ...",
    forgot: "ลืมรหัสผ่าน",
    noAccount: "ยังไม่มีบัญชี",
    register: "สมัครสมาชิก",
  },

  register: {
    title: "สมัครสมาชิก",
    subtitle: "เริ่มต้นใช้งาน getownly ได้ฟรี ไม่มีค่าใช้จ่ายแรกเข้า",
    progressLabel: "ขั้นตอนการสมัครสมาชิก",
    roleStepTitle: "คุณต้องการใช้งานในบทบาทใด",
    roleStepSubtitle: "เลือกบทบาทที่ตรงกับคุณ เปลี่ยนภายหลังไม่ได้",
    roles: {
      STUDENT: {
        title: "ผู้เรียน",
        description: "ค้นหาและซื้อคอร์ส เรียนได้ทุกที่ทุกเวลา ทำแบบทดสอบและรับใบประกาศนียบัตร",
      },
      INSTRUCTOR: {
        title: "ผู้สอน",
        description: "เปิดคอร์สของตัวเอง อัปโหลดวิดีโอและเอกสาร ตอบคำถามผู้เรียน และดูรายได้",
      },
    },
    selectedRolePrefix: "สมัครในบทบาท",
    changeRole: "เปลี่ยนบทบาท",
    displayName: "ชื่อที่ใช้แสดง",
    displayNamePlaceholder: "ชื่อที่จะปรากฏต่อผู้ใช้อื่น",
    email: "อีเมล",
    emailPlaceholder: "you@example.com",
    username: "ชื่อผู้ใช้",
    usernamePlaceholder: "ใช้ตัวอักษรภาษาอังกฤษตัวเล็ก ตัวเลข จุด และขีดล่าง",
    password: "รหัสผ่าน",
    passwordPlaceholder: "อย่างน้อย 8 ตัวอักษร มีทั้งตัวอักษรและตัวเลข",
    confirmPassword: "ยืนยันรหัสผ่าน",
    confirmPasswordPlaceholder: "กรอกรหัสผ่านอีกครั้ง",
    submit: "สมัครสมาชิก",
    submitting: "กำลังสมัครสมาชิก...",
    haveAccount: "มีบัญชีอยู่แล้ว",
    login: "เข้าสู่ระบบ",
    terms: "การสมัครสมาชิกถือว่าคุณยอมรับเงื่อนไขการใช้งานของแพลตฟอร์ม",
  },

  forgotPassword: {
    title: "ลืมรหัสผ่าน",
    subtitle: "กรอกอีเมลที่ใช้สมัคร แล้วเราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้",
    email: "อีเมล",
    emailPlaceholder: "you@example.com",
    submit: "ส่งลิงก์ตั้งรหัสผ่านใหม่",
    submitting: "กำลังส่ง...",
    backToLogin: "กลับไปหน้าเข้าสู่ระบบ",
    checkInbox: "ตรวจสอบกล่องจดหมายของคุณ",
  },

  resetPassword: {
    title: "ตั้งรหัสผ่านใหม่",
    subtitle: "กำหนดรหัสผ่านใหม่สำหรับบัญชีของคุณ",
    password: "รหัสผ่านใหม่",
    passwordPlaceholder: "อย่างน้อย 8 ตัวอักษร มีทั้งตัวอักษรและตัวเลข",
    confirmPassword: "ยืนยันรหัสผ่านใหม่",
    confirmPasswordPlaceholder: "กรอกรหัสผ่านใหม่อีกครั้ง",
    submit: "บันทึกรหัสผ่านใหม่",
    submitting: "กำลังบันทึก...",
    missingToken: "ลิงก์ตั้งรหัสผ่านใหม่ไม่ถูกต้องหรือไม่สมบูรณ์ กรุณาขอลิงก์ใหม่อีกครั้ง",
    requestNewLink: "ขอลิงก์ใหม่",
    goToLogin: "ไปหน้าเข้าสู่ระบบ",
  },

  validation: {
    identifierRequired: "กรุณากรอกอีเมลหรือชื่อผู้ใช้",
    emailRequired: "กรุณากรอกอีเมล",
    emailInvalid: "รูปแบบอีเมลไม่ถูกต้อง",
    usernameRequired: "กรุณากรอกชื่อผู้ใช้",
    usernameTooShort: "ชื่อผู้ใช้ต้องยาวอย่างน้อย 3 ตัวอักษร",
    usernameTooLong: "ชื่อผู้ใช้ต้องยาวไม่เกิน 30 ตัวอักษร",
    usernamePattern: "ใช้ได้เฉพาะตัวอักษรภาษาอังกฤษตัวเล็ก ตัวเลข จุด และขีดล่าง",
    displayNameRequired: "กรุณากรอกชื่อที่ใช้แสดง",
    displayNameTooShort: "ชื่อที่ใช้แสดงต้องยาวอย่างน้อย 2 ตัวอักษร",
    displayNameTooLong: "ชื่อที่ใช้แสดงต้องยาวไม่เกิน 80 ตัวอักษร",
    passwordRequired: "กรุณากรอกรหัสผ่าน",
    passwordTooShort: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร",
    passwordTooLong: "รหัสผ่านต้องยาวไม่เกิน 72 ตัวอักษร",
    passwordPattern: "รหัสผ่านต้องมีทั้งตัวอักษรและตัวเลข",
    confirmPasswordMismatch: "รหัสผ่านทั้งสองช่องไม่ตรงกัน",
    roleRequired: "กรุณาเลือกบทบาท",
  },

  errors: {
    network: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่",
    unexpected: "เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง",
  },
} as const;
