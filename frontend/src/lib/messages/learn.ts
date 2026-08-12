/**
 * Every Thai string the classroom and quiz screens show, in one place
 * (CLAUDE.md, หัวข้อ 5). Components must not hold loose Thai literals.
 */
export const learnMessages = {
  room: {
    loading: "กำลังเปิดห้องเรียน...",
    errorTitle: "เข้าห้องเรียนไม่สำเร็จ",
    emptyTitle: "คอร์สนี้ยังไม่มีบทเรียน",
    emptyBody: "ผู้สอนยังไม่ได้เพิ่มบทเรียนในคอร์สนี้ กรุณากลับมาใหม่อีกครั้ง",
    backToMyCourses: "กลับไปคอร์สของฉัน",
    retry: "ลองใหม่อีกครั้ง",
  },

  sidebar: {
    heading: "เนื้อหาบทเรียน",
    /** ประกอบเป็น "เรียนแล้ว 3 จาก 8 บท" */
    progressPrefix: "เรียนแล้ว",
    progressMiddle: "จาก",
    progressSuffix: "บท",
    completed: "เรียนจบแล้ว",
    current: "บทเรียนปัจจุบัน",
    hasQuiz: "มีแบบทดสอบ",
    quizPassed: "ผ่านแบบทดสอบแล้ว",
    materialsSuffix: "ไฟล์แนบ",
  },

  player: {
    noVideo: "บทเรียนนี้ยังไม่มีวิดีโอ",
    loadFailed: "เล่นวิดีโอไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    lessonPrefix: "บทที่",
    markComplete: "ทำเครื่องหมายว่าเรียนจบแล้ว",
    marking: "กำลังบันทึก...",
    completed: "เรียนจบบทนี้แล้ว",
    takeQuiz: "ทำแบบทดสอบท้ายบท",
    nextLesson: "บทเรียนถัดไป",
    prevLesson: "บทก่อนหน้า",
    finishCourse: "เรียนจบทุกบทแล้ว",
  },

  tabs: {
    details: "รายละเอียด",
    materials: "เอกสารประกอบ",
    qna: "ถาม-ตอบ",
  },

  details: {
    course: "คอร์ส",
    instructor: "ผู้สอน",
    duration: "ความยาวบทเรียน",
    status: "สถานะ",
    notCompleted: "ยังเรียนไม่จบ",
    completedAt: "เรียนจบเมื่อ",
    autoCompleteNote: "ระบบจะทำเครื่องหมายว่าเรียนจบให้อัตโนมัติเมื่อดูวิดีโอครบ 90%",
  },

  materials: {
    emptyTitle: "บทเรียนนี้ยังไม่มีเอกสารประกอบ",
    emptyBody: "หากผู้สอนเพิ่มไฟล์ในภายหลัง จะปรากฏที่นี่",
    download: "ดาวน์โหลด",
    unavailable: "ลิงก์ดาวน์โหลดไม่พร้อมใช้งานชั่วคราว",
  },

  qna: {
    title: "ถามผู้สอนได้ที่กระดานถาม-ตอบ",
    body: "คำถามและคำตอบทั้งหมดของคอร์สนี้รวมอยู่ที่เดียว ถ้าตั้งคำถามจากบทเรียนนี้ ระบบจะแนบชื่อบทให้อัตโนมัติ",
    open: "เปิดกระดานถาม-ตอบ",
  },

  quiz: {
    loading: "กำลังโหลดแบบทดสอบ...",
    errorTitle: "โหลดแบบทดสอบไม่สำเร็จ",
    /** ประกอบเป็น "ข้อ 3 จาก 10" */
    questionPrefix: "ข้อ",
    questionMiddle: "จาก",
    passScorePrefix: "เกณฑ์ผ่าน",
    percentSuffix: "%",
    attemptCountPrefix: "ทำมาแล้ว",
    attemptCountSuffix: "ครั้ง",
    bestScorePrefix: "คะแนนสูงสุด",
    prev: "ข้อก่อนหน้า",
    next: "ข้อถัดไป",
    submit: "ส่งคำตอบ",
    submitting: "กำลังตรวจคำตอบ...",
    unanswered: "กรุณาตอบให้ครบทุกข้อก่อนส่งคำตอบ",
    unansweredCountPrefix: "ยังไม่ได้ตอบอีก",
    unansweredCountSuffix: "ข้อ",
    answeredAll: "ตอบครบทุกข้อแล้ว",
    jumpLabel: "ไปยังข้อที่",
    backToLesson: "กลับไปบทเรียน",
    unlimitedNote: "ทำแบบทดสอบซ้ำได้ไม่จำกัดครั้ง ระบบจะเก็บคะแนนสูงสุดไว้",
  },

  result: {
    title: "ผลการทำแบบทดสอบ",
    loading: "กำลังโหลดผลการทำแบบทดสอบ...",
    errorTitle: "โหลดผลการทำแบบทดสอบไม่สำเร็จ",
    emptyTitle: "ยังไม่มีผลการทำแบบทดสอบ",
    emptyBody: "เมื่อส่งคำตอบแล้ว ผลและเฉลยจะแสดงที่นี่",
    passed: "ผ่านเกณฑ์",
    failed: "ยังไม่ผ่านเกณฑ์",
    /** ประกอบเป็น "ตอบถูก 8 จาก 10 ข้อ" */
    correctPrefix: "ตอบถูก",
    correctMiddle: "จาก",
    correctSuffix: "ข้อ",
    answerKeyHeading: "เฉลยรายข้อ",
    yourAnswer: "คำตอบของคุณ",
    correctAnswer: "คำตอบที่ถูกต้อง",
    retake: "ทำแบบทดสอบอีกครั้ง",
    history: "ประวัติการทำแบบทดสอบ",
    attemptPrefix: "ครั้งที่",
    scoreSuffix: "คะแนน",
  },
} as const;
