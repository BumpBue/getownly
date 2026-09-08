/**
 * Every Thai string the catalog screens show, in one place
 * (CLAUDE.md, หัวข้อ 5). Components must not hold loose Thai literals.
 */
export const courseMessages = {
  catalog: {
    title: 'คอร์สเรียนทั้งหมด',
    subtitle: 'เลือกคอร์สที่ใช่ จากผู้สอนตัวจริงในแต่ละสาขา',
    resultsPrefix: 'พบ',
    resultsSuffix: 'คอร์ส',
    loading: 'กำลังโหลดคอร์ส...',
    emptyTitle: 'ไม่พบคอร์สที่ตรงกับเงื่อนไข',
    emptyBody: 'ลองปรับคำค้นหาหรือล้างตัวกรองแล้วค้นหาอีกครั้ง',
    errorTitle: 'โหลดรายการคอร์สไม่สำเร็จ',
    errorBody: 'เกิดข้อผิดพลาดระหว่างดึงข้อมูล กรุณาลองใหม่อีกครั้ง',
    retry: 'ลองใหม่อีกครั้ง',
  },

  filters: {
    heading: 'ตัวกรอง',
    search: 'ค้นหา',
    searchPlaceholder: 'ชื่อคอร์สหรือคำอธิบาย',
    category: 'หมวดหมู่',
    allCategories: 'ทุกหมวดหมู่',
    price: 'ช่วงราคา',
    minPrice: 'ต่ำสุด',
    maxPrice: 'สูงสุด',
    instructor: 'ผู้สอน',
    allInstructors: 'ผู้สอนทุกคน',
    freeOnly: 'แสดงเฉพาะคอร์สฟรี',
    sort: 'เรียงลำดับ',
    apply: 'ใช้ตัวกรอง',
    clear: 'ล้างตัวกรอง',
    sortLabels: {
      latest: 'ใหม่ล่าสุด',
      popular: 'ยอดนิยม',
      price_asc: 'ราคาน้อยไปมาก',
      price_desc: 'ราคามากไปน้อย',
    },
  },

  card: {
    free: 'ฟรี',
    lessonsSuffix: 'บทเรียน',
    studentsSuffix: 'ผู้เรียน',
    noCover: 'ยังไม่มีภาพหน้าปก',
  },

  detail: {
    metaTitle: 'รายละเอียดคอร์ส',
    backToCatalog: 'กลับไปหน้ารวมคอร์ส',
    aboutHeading: 'เกี่ยวกับคอร์สนี้',
    curriculumHeading: 'เนื้อหาบทเรียน',
    instructorHeading: 'ผู้สอน',
    previewBadge: 'ดูตัวอย่างได้',
    previewOpen: 'ดูตัวอย่าง',
    previewDialogTitle: 'ดูตัวอย่างบทเรียน',
    previewClose: 'ปิด',
    previewLoading: 'กำลังเตรียมวิดีโอ...',
    previewSignInPrompt: 'เข้าสู่ระบบเพื่อดูตัวอย่างบทเรียนนี้',
    // Each failure says which one it was: "ลองใหม่" alone leaves a viewer
    // retrying something that will never work, such as a lesson whose video
    // the instructor has not uploaded.
    previewNoVideo: 'ผู้สอนยังไม่ได้อัปโหลดวิดีโอของบทเรียนนี้ จึงยังดูตัวอย่างไม่ได้',
    previewForbidden: 'บทเรียนนี้ไม่ได้เปิดให้ดูตัวอย่าง',
    previewSessionExpired: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง',
    previewFailed: 'เล่นวิดีโอตัวอย่างไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
    lockedLesson: 'ซื้อคอร์สนี้เพื่อเข้าเรียนบทนี้',
    materialsSuffix: 'ไฟล์แนบ',
    emptyCurriculum: 'ผู้สอนยังไม่ได้เพิ่มบทเรียนในคอร์สนี้',
    alreadyOwned: 'คุณมีคอร์สนี้แล้ว',
    ownerNotice: 'นี่คือคอร์สของคุณเอง',
    editCourse: 'แก้ไขคอร์ส',
    // The buy / top-up / enrol wording lives in messages/wallet.ts, next to the
    // panel that owns those decisions, so there is one place to change it.
    priceNote: 'ซื้อครั้งเดียว เรียนได้ตลอดชีพ',
    includes: 'สิ่งที่ได้รับ',
    includesLifetime: 'เข้าเรียนได้ตลอดชีพ ไม่มีวันหมดอายุ',
    includesDevices: 'เรียนได้ทุกอุปกรณ์ผ่านเว็บเบราว์เซอร์',
    includesMaterials: 'ดาวน์โหลดเอกสารประกอบได้ทุกบท',
    notFoundTitle: 'ไม่พบคอร์สที่ต้องการ',
    notFoundBody: 'คอร์สนี้อาจถูกลบไปแล้ว หรือยังไม่ได้เผยแพร่',
    totalLength: 'ความยาวรวม',
  },

  status: {
    DRAFT: 'ฉบับร่าง',
    PENDING_REVIEW: 'รอตรวจสอบ',
    PUBLISHED: 'เผยแพร่แล้ว',
    REJECTED: 'ถูกปฏิเสธ',
    UNPUBLISHED: 'ถอดออกจากการขาย',
    SUSPENDED: 'ถูกระงับชั่วคราว',
  },
} as const;
