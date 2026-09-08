/**
 * Every Thai string the withdrawal screens use — the instructor's own page and
 * the admin review queue.
 *
 * Kept in one file per domain, the way the rest of the application does it, so
 * no wording is written twice and no English leaks onto a screen.
 */

export const payoutMessages = {
  status: {
    PENDING: "รอตรวจสอบ",
    APPROVED: "โอนแล้ว",
    REJECTED: "ถูกปฏิเสธ",
    CANCELLED: "ยกเลิกแล้ว",
  },

  instructor: {
    title: "ถอนเงิน",
    subtitle: "โอนรายได้ในกระเป๋าเงินออกไปยังบัญชีธนาคารของคุณ",

    balanceLabel: "ยอดคงเหลือในกระเป๋า",
    withdrawableLabel: "ยอดที่ถอนได้",
    sameAsBalance: "เท่ากับยอดคงเหลือ เพราะคำขอที่ยื่นแล้วถูกหักออกจากกระเป๋าทันที",
    pendingNotice: (amount: string) =>
      `มีคำขอถอน ${amount} บาท รอการอนุมัติอยู่ — จำนวนนี้ถูกหักออกจากกระเป๋าเงินแล้ว ` +
      "และจะถูกคืนให้ทันทีถ้าคำขอถูกปฏิเสธหรือคุณยกเลิกเอง",
    minimumNotice: (amount: string) => `ถอนได้ครั้งละไม่ต่ำกว่า ${amount} บาท`,
    oneAtATime: "ยื่นคำขอได้ครั้งละ 1 รายการ",
    reviewTargetNotice: "ผู้ดูแลระบบจะตรวจสอบและโอนเงินให้ตามรอบการโอนของแพลตฟอร์ม",

    bankTitle: "บัญชีธนาคารที่รับเงิน",
    bankEmpty: "ยังไม่ได้บันทึกบัญชีธนาคาร",
    bankEmptyHint: "บันทึกบัญชีธนาคารก่อน จึงจะยื่นคำขอถอนเงินได้",
    bankNameLabel: "ธนาคาร",
    bankSelectPlaceholder: "เลือกธนาคาร",
    bankSearchPlaceholder: "พิมพ์ชื่อธนาคาร ตัวย่อ หรือรหัส",
    bankSearchEmpty: "ไม่พบธนาคารที่ค้นหา",
    accountNameLabel: "ชื่อบัญชี",
    accountNumberLabel: "เลขที่บัญชี",
    accountNumberHint: "ตัวเลข 8–20 หลัก ใส่ขีดหรือเว้นวรรคคั่นได้",
    bankEdit: "แก้ไขบัญชีธนาคาร",
    bankAdd: "บันทึกบัญชีธนาคาร",
    bankSave: "บันทึก",
    bankCancel: "ยกเลิก",
    bankSaved: "บันทึกบัญชีธนาคารแล้ว",
    bankMaskNotice: "เลขบัญชีจะแสดงเฉพาะ 4 ตัวท้ายในหน้าอื่นทั้งหมด",

    formTitle: "ยื่นคำขอถอนเงิน",
    amountLabel: "จำนวนเงินที่ต้องการถอน (บาท)",
    submit: "ยื่นคำขอถอนเงิน",
    submitting: "กำลังส่งคำขอ...",
    submitted: "ส่งคำขอถอนเงินแล้ว",
    withdrawAll: "ถอนทั้งหมด",

    cancel: "ยกเลิกคำขอ",
    cancelConfirm: "ยกเลิกคำขอถอนเงินนี้ใช่หรือไม่ เงินจะถูกคืนเข้ากระเป๋าทันที",
    cancelled: "ยกเลิกคำขอแล้ว เงินถูกคืนเข้ากระเป๋าเรียบร้อย",

    historyTitle: "ประวัติการถอนเงิน",
    historyEmpty: "ยังไม่มีประวัติการถอนเงิน",
    columnDate: "วันที่ยื่น",
    columnAmount: "จำนวนเงิน",
    columnAccount: "บัญชีปลายทาง",
    columnStatus: "สถานะ",
    columnNote: "หมายเหตุ",
    reviewedAt: "ตรวจสอบเมื่อ",

    loading: "กำลังโหลดข้อมูลการถอนเงิน...",
    loadFailed: "โหลดข้อมูลการถอนเงินไม่สำเร็จ",
    retry: "ลองใหม่อีกครั้ง",
  },

  admin: {
    title: "คิวคำขอถอนเงินของผู้สอน",
    subtitle: "ตรวจสอบบัญชีปลายทาง โอนเงินจริง แล้วจึงกดอนุมัติเพื่อบันทึกรายการ",

    pendingBadgePrefix: "รอตรวจสอบ",
    pendingBadgeSuffix: "รายการ",
    heldTotalPrefix: "เงินที่กันไว้รอโอนรวม",
    heldTotalSuffix: "บาท",
    heldExplain: "จำนวนนี้ถูกหักจากกระเป๋าเงินของผู้สอนแล้ว และยังไม่ได้ออกจากระบบ",

    filterAll: "ทั้งหมด",
    columnInstructor: "ผู้สอน",
    columnAmount: "จำนวนที่ขอถอน",
    columnBalance: "ยอดคงเหลือหลังกันเงิน",
    columnAccount: "บัญชีปลายทาง",
    columnRequestedAt: "ยื่นเมื่อ",
    columnStatus: "สถานะ",

    review: "ตรวจสอบ",
    view: "ดูรายละเอียด",
    empty: "ยังไม่มีคำขอถอนเงินในสถานะนี้",

    dialogTitle: "ตรวจสอบคำขอถอนเงิน",
    dialogAccountHeading: "บัญชีปลายทาง",
    dialogAccountNotice: "เลขบัญชีเต็มแสดงเฉพาะหน้านี้ เพื่อใช้โอนเงินจริง",
    dialogAmountHeading: "จำนวนที่ต้องโอน",
    dialogInstructorHeading: "ผู้สอน",
    dialogBalanceHeading: "ยอดคงเหลือในกระเป๋าตอนนี้",
    dialogHeldNotice:
      "เงินจำนวนนี้ถูกหักจากกระเป๋าของผู้สอนตั้งแต่ตอนยื่นคำขอแล้ว " +
      "การกดอนุมัติเป็นการบันทึกว่าโอนออกจากระบบเรียบร้อย",
    dialogApprove: "อนุมัติ (โอนแล้ว)",
    dialogApproveConfirm: "ยืนยันว่าโอนเงินให้ผู้สอนเรียบร้อยแล้วใช่หรือไม่",
    dialogReject: "ปฏิเสธและคืนเงิน",
    dialogRejectNote: "เหตุผลที่ปฏิเสธ",
    dialogRejectNotePlaceholder: "เช่น เลขบัญชีไม่ถูกต้อง ชื่อบัญชีไม่ตรงกับชื่อผู้สอน",
    dialogClose: "ปิด",
    dialogReviewedNotice: "คำขอนี้ถูกตรวจสอบไปแล้ว",

    approved: "บันทึกการโอนเรียบร้อยแล้ว",
    rejected: "ปฏิเสธคำขอและคืนเงินเข้ากระเป๋าผู้สอนแล้ว",

    loading: "กำลังโหลดคิวคำขอถอนเงิน...",
    loadFailed: "โหลดคิวคำขอถอนเงินไม่สำเร็จ",
    retry: "ลองใหม่อีกครั้ง",
  },
} as const;
