import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './business.exception';

// Errors raised by the catalog: courses, lessons, materials and uploads.
// English `code` for the frontend to branch on, Thai `message` to show as-is.
//
// They live in common/ rather than inside one module because more than one
// module raises them: the ledger needs COURSE_NOT_FOUND when a purchase names
// a course that is gone, exactly as the catalog does.

export class CourseNotFoundException extends BusinessException {
  constructor() {
    super(HttpStatus.NOT_FOUND, 'COURSE_NOT_FOUND', 'ไม่พบคอร์สที่ระบุ');
  }
}

/**
 * Deliberately the same 404 as "course does not exist".
 *
 * Someone who is not the owner must not be able to tell an unpublished course
 * apart from a nonexistent one, or the id space becomes a list of draft ids.
 */
export class CourseNotVisibleException extends CourseNotFoundException {}

export class NotCourseOwnerException extends BusinessException {
  constructor() {
    super(HttpStatus.FORBIDDEN, 'NOT_COURSE_OWNER', 'คุณไม่ใช่เจ้าของคอร์สนี้ จึงไม่มีสิทธิ์แก้ไข');
  }
}

export class CourseNotEditableException extends BusinessException {
  constructor(currentStatus: string) {
    super(
      HttpStatus.CONFLICT,
      'COURSE_NOT_EDITABLE',
      'คอร์สนี้อยู่ระหว่างการตรวจสอบ จึงยังแก้ไขไม่ได้ กรุณารอผลการตรวจสอบก่อน',
      { currentStatus },
    );
  }
}

export class CourseNotDeletableException extends BusinessException {
  constructor(reason: 'STATUS' | 'HAS_ENROLLMENTS', currentStatus: string) {
    super(
      HttpStatus.CONFLICT,
      'COURSE_NOT_DELETABLE',
      reason === 'HAS_ENROLLMENTS'
        ? 'คอร์สนี้มีผู้เรียนลงทะเบียนแล้ว จึงลบไม่ได้'
        : 'ลบได้เฉพาะคอร์สที่เป็นฉบับร่างเท่านั้น',
      { reason, currentStatus },
    );
  }
}

export class CourseNotSubmittableException extends BusinessException {
  constructor(currentStatus: string) {
    super(
      HttpStatus.CONFLICT,
      'COURSE_NOT_SUBMITTABLE',
      'ส่งตรวจสอบได้เฉพาะคอร์สที่เป็นฉบับร่างหรือถูกปฏิเสธเท่านั้น',
      { currentStatus },
    );
  }
}

export class CourseNotUnpublishableException extends BusinessException {
  constructor(currentStatus: string) {
    super(
      HttpStatus.CONFLICT,
      'COURSE_NOT_UNPUBLISHABLE',
      'ถอดออกจากการขายได้เฉพาะคอร์สที่เผยแพร่อยู่เท่านั้น',
      { currentStatus },
    );
  }
}

/** The checklist a course must pass before an admin is asked to look at it. */
export class CourseIncompleteException extends BusinessException {
  constructor(missing: string[]) {
    super(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'COURSE_INCOMPLETE',
      'คอร์สยังไม่พร้อมส่งตรวจสอบ กรุณากรอกข้อมูลที่ยังขาดให้ครบก่อน',
      { missing },
    );
  }
}

export class CategoryNotFoundException extends BusinessException {
  constructor() {
    super(HttpStatus.NOT_FOUND, 'CATEGORY_NOT_FOUND', 'ไม่พบหมวดหมู่ที่ระบุ');
  }
}

export class LessonNotFoundException extends BusinessException {
  constructor() {
    super(HttpStatus.NOT_FOUND, 'LESSON_NOT_FOUND', 'ไม่พบบทเรียนที่ระบุ');
  }
}

export class LessonHasNoVideoException extends BusinessException {
  constructor() {
    super(HttpStatus.NOT_FOUND, 'LESSON_HAS_NO_VIDEO', 'บทเรียนนี้ยังไม่มีวิดีโอ');
  }
}

/** Raised when a reorder payload is not a permutation of the course's lessons. */
export class LessonOrderMismatchException extends BusinessException {
  constructor() {
    super(
      HttpStatus.BAD_REQUEST,
      'LESSON_ORDER_MISMATCH',
      'ลำดับบทเรียนที่ส่งมาไม่ตรงกับบทเรียนทั้งหมดของคอร์สนี้',
    );
  }
}

export class MaterialNotFoundException extends BusinessException {
  constructor() {
    super(HttpStatus.NOT_FOUND, 'MATERIAL_NOT_FOUND', 'ไม่พบเอกสารประกอบที่ระบุ');
  }
}

/** The browser asked for bytes past the end of the video. */
export class RangeNotSatisfiableException extends BusinessException {
  constructor(sizeBytes: number) {
    super(
      HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
      'RANGE_NOT_SATISFIABLE',
      'ช่วงข้อมูลที่ร้องขออยู่นอกขอบเขตของไฟล์',
      { sizeBytes },
    );
  }
}

/** Not enrolled, not the owner, and the lesson is not a free preview. */
export class LessonAccessDeniedException extends BusinessException {
  constructor() {
    super(
      HttpStatus.FORBIDDEN,
      'LESSON_ACCESS_DENIED',
      'ต้องลงทะเบียนคอร์สนี้ก่อนจึงจะเข้าถึงเนื้อหาบทนี้ได้',
    );
  }
}
