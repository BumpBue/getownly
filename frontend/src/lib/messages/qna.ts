/**
 * Every Thai string the Q&A screens show, in one place
 * (CLAUDE.md, หัวข้อ 5). Components must not hold loose Thai literals.
 */
export const qnaMessages = {
  board: {
    title: "ถาม-ตอบ",
    subtitle: "ถามผู้สอนได้ทุกเรื่องเกี่ยวกับคอร์สนี้ เพื่อนร่วมคอร์สก็ช่วยตอบได้",
    backToCourse: "กลับไปห้องเรียน",
    /** ใช้กับผู้สอนและผู้ดูแล ซึ่งไม่มีห้องเรียนของคอร์สนี้ให้กลับไป */
    backToCourseDetail: "กลับไปหน้าคอร์ส",
    ask: "ตั้งคำถามใหม่",
    loading: "กำลังโหลดกระทู้...",
    errorTitle: "โหลดกระดานถาม-ตอบไม่สำเร็จ",
    retry: "ลองใหม่อีกครั้ง",
    emptyTitle: "ยังไม่มีคำถามในคอร์สนี้",
    emptyBody: "ถ้ามีอะไรติดขัด ตั้งคำถามได้เลย ผู้สอนจะเห็นในกล่องคำถามของตัวเอง",
    emptyFilteredTitle: "ไม่พบกระทู้ที่ตรงกับเงื่อนไข",
    emptyFilteredBody: "ลองเปลี่ยนตัวกรองหรือล้างคำค้นหาแล้วดูอีกครั้ง",
    searchPlaceholder: "ค้นหาจากหัวข้อหรือเนื้อหาคำถาม",
    search: "ค้นหา",
    clearSearch: "ล้างคำค้นหา",
    filters: {
      all: "ทั้งหมด",
      unanswered: "รอคำตอบ",
      answered: "ผู้สอนตอบแล้ว",
    },
    /** ประกอบเป็น "8 กระทู้" */
    threadCountSuffix: "กระทู้",
    instructorNotice: "คุณเป็นผู้สอนของคอร์สนี้ จึงตอบคำถามได้แต่ตั้งคำถามไม่ได้",
    adminNotice: "คุณกำลังดูในฐานะผู้ดูแลระบบ จึงอ่านและลบกระทู้ได้แต่ร่วมสนทนาไม่ได้",
  },

  badge: {
    answered: "ผู้สอนตอบแล้ว",
    waiting: "รอคำตอบ",
    resolved: "ปิดกระทู้แล้ว",
    instructor: "ผู้สอน",
    asker: "ผู้ถาม",
  },

  meta: {
    askedBy: "ถามโดย",
    askedAt: "เมื่อ",
    /** ประกอบเป็น "ตอบแล้ว 3 ครั้ง" */
    replyCountPrefix: "ตอบแล้ว",
    replyCountSuffix: "ครั้ง",
    noReplies: "ยังไม่มีคำตอบ",
    lastReplyPrefix: "ตอบล่าสุด",
    fromLesson: "จากบทเรียน",
  },

  ask: {
    title: "ตั้งคำถามใหม่",
    subtitle: "เขียนให้ชัดว่าติดตรงไหน ทำอะไรไปแล้วบ้าง จะได้คำตอบที่ตรงจุดเร็วขึ้น",
    titleLabel: "หัวข้อคำถาม",
    titlePlaceholder: "สรุปคำถามให้สั้นที่สุดใน 1 บรรทัด",
    bodyLabel: "รายละเอียด",
    bodyPlaceholder: "อธิบายสิ่งที่ทำไปแล้วและผลที่ได้ ถ้ามีข้อความผิดพลาดให้คัดลอกมาด้วย",
    lessonLabel: "บทเรียนที่เกี่ยวข้อง",
    lessonNone: "ไม่ระบุบทเรียน",
    submit: "ส่งคำถาม",
    submitting: "กำลังส่งคำถาม...",
    cancel: "ยกเลิก",
  },

  thread: {
    loading: "กำลังโหลดกระทู้...",
    errorTitle: "โหลดกระทู้ไม่สำเร็จ",
    backToBoard: "กลับไปกระดานถาม-ตอบ",
    repliesHeading: "คำตอบ",
    noRepliesTitle: "ยังไม่มีใครตอบคำถามนี้",
    noRepliesBody: "ถ้าคุณรู้คำตอบ ช่วยตอบเพื่อนร่วมคอร์สได้เลย",
    replyLabel: "เขียนคำตอบ",
    replyPlaceholder: "พิมพ์คำตอบของคุณที่นี่",
    reply: "ส่งคำตอบ",
    replying: "กำลังส่งคำตอบ...",
    replyClosedNotice: "คุณไม่มีสิทธิ์ตอบในกระทู้นี้",
    resolve: "ปิดกระทู้",
    reopen: "เปิดกระทู้อีกครั้ง",
    resolving: "กำลังบันทึก...",
    resolvedNotice: "กระทู้นี้ถูกปิดแล้ว แต่ยังตอบเพิ่มได้ถ้ามีอะไรค้างอยู่",
    remove: "ลบกระทู้",
    removeConfirm: "ยืนยันการลบกระทู้นี้ คำตอบทั้งหมดจะถูกลบไปด้วยและกู้คืนไม่ได้",
    removing: "กำลังลบ...",
  },

  inbox: {
    title: "กล่องคำถาม",
    subtitle: "คำถามจากผู้เรียนที่ยังรอคุณตอบ เรียงจากที่รอนานที่สุด",
    loading: "กำลังโหลดคำถาม...",
    errorTitle: "โหลดกล่องคำถามไม่สำเร็จ",
    emptyTitle: "ไม่มีคำถามค้างอยู่",
    emptyBody: "ตอบครบทุกคำถามแล้ว เมื่อมีผู้เรียนถามใหม่จะปรากฏที่นี่",
    emptyFilteredTitle: "ไม่พบคำถามที่ตรงกับคำค้นหา",
    emptyFilteredBody: "ลองใช้คำค้นหาอื่น หรือล้างคำค้นหาเพื่อดูทั้งหมด",
    /** ประกอบเป็น "รอตอบ 5 คำถาม" */
    pendingPrefix: "รอตอบ",
    pendingSuffix: "คำถาม",
    open: "เปิดกระทู้",
    courseLabel: "คอร์ส",
  },
} as const;
