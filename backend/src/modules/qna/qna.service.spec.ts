import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '@/infra/prisma.service';
import { CourseAccessService } from '@/modules/courses/course-access.service';
import { QnaService } from './qna.service';
import {
  asAuthUser,
  createCategory,
  createCourse,
  createLesson,
  createUser,
  enrol,
  resetDatabase,
  type TestUser,
} from '../../../test/factories';

describe('QnaService', () => {
  let prisma: PrismaService;
  let qna: QnaService;

  let instructor: TestUser;
  let student: TestUser;
  let classmate: TestUser;
  let outsider: TestUser;
  let admin: TestUser;
  let courseId: string;
  let lessonId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    qna = new QnaService(prisma, new CourseAccessService(prisma));

    instructor = await createUser(prisma, { role: 'INSTRUCTOR', displayName: 'ครูทดสอบ' });
    student = await createUser(prisma, { role: 'STUDENT', displayName: 'ผู้เรียนหนึ่ง' });
    classmate = await createUser(prisma, { role: 'STUDENT', displayName: 'ผู้เรียนสอง' });
    outsider = await createUser(prisma, { role: 'STUDENT' });
    admin = await createUser(prisma, { role: 'ADMIN' });

    const categoryId = await createCategory(prisma);
    courseId = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '1000.00',
      title: 'คอร์สถามตอบ',
    });
    lessonId = await createLesson(prisma, { courseId, orderIndex: 1 });

    await enrol(prisma, { courseId, studentId: student.id });
    await enrol(prisma, { courseId, studentId: classmate.id });
  });

  const question = { title: 'ตั้งค่าโปรเจกต์ยังไง', body: 'ทำตามคลิปแล้วไม่ขึ้นเมนูตามที่สอน' };

  /** Asks one question as the enrolled student, returning the thread. */
  const ask = () => qna.createThread(courseId, asAuthUser(student), question);

  // --- who may see the board ------------------------------------------------

  it('opens the board to the enrolled student, the instructor and an admin', async () => {
    await ask();

    for (const viewer of [student, classmate, instructor, admin]) {
      const board = await qna.listForCourse(courseId, asAuthUser(viewer), {});
      expect(board.total).toBe(1);
    }
  });

  it('refuses the board to someone who has not bought the course', async () => {
    await expect(qna.listForCourse(courseId, asAuthUser(outsider), {})).rejects.toMatchObject({
      code: 'QNA_ACCESS_DENIED',
    });
  });

  it('refuses one thread to someone who has not bought the course', async () => {
    const thread = await ask();

    await expect(qna.getThread(thread.id, asAuthUser(outsider))).rejects.toMatchObject({
      code: 'QNA_ACCESS_DENIED',
    });
  });

  it('answers 404 for a course that does not exist', async () => {
    await expect(
      qna.listForCourse('does-not-exist', asAuthUser(student), {}),
    ).rejects.toMatchObject({ code: 'COURSE_NOT_FOUND' });
  });

  // --- asking ---------------------------------------------------------------

  it('records a question against its author', async () => {
    const thread = await ask();

    expect(thread.title).toBe(question.title);
    expect(thread.author).toEqual({ id: student.id, displayName: 'ผู้เรียนหนึ่ง' });
    expect(thread.courseTitle).toBe('คอร์สถามตอบ');
    expect(thread.isResolved).toBe(false);
    expect(thread.replyCount).toBe(0);
    expect(thread.hasInstructorReply).toBe(false);
    expect(thread.lastReplyAt).toBeNull();
  });

  it('never lets an author row travel whole', async () => {
    const thread = await ask();
    await qna.createReply(thread.id, asAuthUser(instructor), { body: 'ลองตั้ง Set Project ก่อน' });

    const detail = await qna.getThread(thread.id, asAuthUser(student));

    // A Q&A board is the easiest place to leak a classmate's address
    // (CLAUDE.md, ข้อห้าม 11).
    const payload = JSON.stringify(detail);
    expect(payload).not.toContain('@test.local');
    expect(payload).not.toContain('passwordHash');
  });

  it('refuses a question from the instructor, who has nobody to ask', async () => {
    await expect(
      qna.createThread(courseId, asAuthUser(instructor), question),
    ).rejects.toMatchObject({ code: 'QNA_ASK_REQUIRES_ENROLLMENT' });

    // An admin reads the board but does not take part in it either.
    await expect(qna.createThread(courseId, asAuthUser(admin), question)).rejects.toMatchObject({
      code: 'QNA_ASK_REQUIRES_ENROLLMENT',
    });
  });

  it('ties a question to a lesson when one is named', async () => {
    const thread = await qna.createThread(courseId, asAuthUser(student), {
      ...question,
      lessonId,
    });

    expect(thread.lesson?.id).toBe(lessonId);
  });

  it('refuses a lesson that belongs to another course', async () => {
    const categoryId = await createCategory(prisma);
    const otherCourseId = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '0.00',
    });
    const foreignLessonId = await createLesson(prisma, {
      courseId: otherCourseId,
      orderIndex: 1,
    });

    await expect(
      qna.createThread(courseId, asAuthUser(student), { ...question, lessonId: foreignLessonId }),
    ).rejects.toMatchObject({ code: 'LESSON_NOT_IN_COURSE' });
  });

  // --- answering ------------------------------------------------------------

  it("flags the instructor's reply and nobody else's", async () => {
    const thread = await ask();
    await qna.createReply(thread.id, asAuthUser(classmate), { body: 'เจอเหมือนกันเลย' });
    const answered = await qna.createReply(thread.id, asAuthUser(instructor), {
      body: 'ต้อง Set Project ก่อนเปิดไฟล์ครับ',
    });

    expect(answered.replies).toHaveLength(2);
    expect(answered.replies[0]?.isInstructorReply).toBe(false);
    expect(answered.replies[1]?.isInstructorReply).toBe(true);
    // Oldest first: a conversation is read from the top.
    expect(answered.replies[0]?.body).toBe('เจอเหมือนกันเลย');
    expect(answered.hasInstructorReply).toBe(true);
    expect(answered.replyCount).toBe(2);
    expect(answered.lastReplyAt).not.toBeNull();
  });

  it('lets a classmate answer but not an outsider or an admin', async () => {
    const thread = await ask();

    const replied = await qna.createReply(thread.id, asAuthUser(classmate), {
      body: 'ลองแบบนี้ดู',
    });
    expect(replied.replyCount).toBe(1);

    await expect(
      qna.createReply(thread.id, asAuthUser(outsider), { body: 'ขอตอบด้วย' }),
    ).rejects.toMatchObject({ code: 'QNA_ACCESS_DENIED' });

    await expect(
      qna.createReply(thread.id, asAuthUser(admin), { body: 'ขอตอบด้วย' }),
    ).rejects.toMatchObject({ code: 'QNA_REPLY_NOT_ALLOWED' });
  });

  it('answers 404 for a thread that does not exist', async () => {
    await expect(qna.getThread('does-not-exist', asAuthUser(student))).rejects.toMatchObject({
      code: 'QNA_THREAD_NOT_FOUND',
    });
  });

  // --- filtering ------------------------------------------------------------

  it('counts a thread as unanswered until the instructor replies, not until anyone does', async () => {
    const untouched = await ask();
    const guessedAt = await qna.createThread(courseId, asAuthUser(classmate), {
      title: 'อีกคำถามหนึ่งที่ยังไม่มีคำตอบ',
      body: 'รายละเอียดของคำถามข้อที่สอง',
    });
    await qna.createReply(guessedAt.id, asAuthUser(student), { body: 'เดาว่าน่าจะเป็นแบบนี้' });

    const answeredThread = await qna.createThread(courseId, asAuthUser(student), {
      title: 'คำถามที่ผู้สอนตอบแล้ว',
      body: 'รายละเอียดของคำถามข้อที่สาม',
    });
    await qna.createReply(answeredThread.id, asAuthUser(instructor), { body: 'ตอบให้แล้วครับ' });

    const board = await qna.listForCourse(courseId, asAuthUser(student), {});
    expect(board.total).toBe(3);
    expect(board.unansweredTotal).toBe(2);

    const unanswered = await qna.listForCourse(courseId, asAuthUser(student), {
      filter: 'unanswered',
    });
    expect(unanswered.items.map((item) => item.id).sort()).toEqual(
      [untouched.id, guessedAt.id].sort(),
    );

    const answered = await qna.listForCourse(courseId, asAuthUser(student), {
      filter: 'answered',
    });
    expect(answered.items).toHaveLength(1);
    expect(answered.items[0]?.id).toBe(answeredThread.id);
  });

  it('searches the title and the body', async () => {
    await ask();
    await qna.createThread(courseId, asAuthUser(student), {
      title: 'เรนเดอร์แล้วภาพมืด',
      body: 'ตั้งค่าแสงตามคลิปแล้วยังมืดอยู่',
    });

    const byTitle = await qna.listForCourse(courseId, asAuthUser(student), {
      search: 'เรนเดอร์',
    });
    expect(byTitle.total).toBe(1);

    const byBody = await qna.listForCourse(courseId, asAuthUser(student), { search: 'คลิป' });
    expect(byBody.total).toBe(2);
  });

  it('shows the ask button to students and hides it from the instructor', async () => {
    const asStudent = await qna.listForCourse(courseId, asAuthUser(student), {});
    const asInstructor = await qna.listForCourse(courseId, asAuthUser(instructor), {});

    expect(asStudent.canAsk).toBe(true);
    expect(asInstructor.canAsk).toBe(false);
  });

  it("keeps one course's board out of another's", async () => {
    const categoryId = await createCategory(prisma);
    const otherCourseId = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '0.00',
    });
    await enrol(prisma, { courseId: otherCourseId, studentId: student.id });

    await ask();

    const otherBoard = await qna.listForCourse(otherCourseId, asAuthUser(student), {});
    expect(otherBoard.total).toBe(0);
  });

  // --- closing and deleting -------------------------------------------------

  it('lets the asker and the instructor close a thread, and nobody else', async () => {
    const thread = await ask();

    await expect(qna.setResolved(thread.id, asAuthUser(classmate), {})).rejects.toMatchObject({
      code: 'NOT_QNA_THREAD_OWNER',
    });

    const closed = await qna.setResolved(thread.id, asAuthUser(instructor), {});
    expect(closed.isResolved).toBe(true);

    // Reopening is the same endpoint, so a thread closed by mistake is not stuck.
    const reopened = await qna.setResolved(thread.id, asAuthUser(student), {
      isResolved: false,
    });
    expect(reopened.isResolved).toBe(false);
  });

  it('lets the asker, the instructor and an admin delete, and nobody else', async () => {
    const first = await ask();
    await expect(qna.remove(first.id, asAuthUser(classmate))).rejects.toMatchObject({
      code: 'NOT_QNA_THREAD_OWNER',
    });

    await qna.remove(first.id, asAuthUser(admin));
    expect(await prisma.qnaThread.count({ where: { id: first.id } })).toBe(0);

    const second = await ask();
    await qna.createReply(second.id, asAuthUser(instructor), { body: 'ตอบแล้ว' });
    await qna.remove(second.id, asAuthUser(student));

    // Replies go with the thread rather than being left pointing at nothing.
    expect(await prisma.qnaReply.count({ where: { threadId: second.id } })).toBe(0);
  });

  it('reports what the viewer may do, so the screen shows only buttons that work', async () => {
    const thread = await ask();

    const asAsker = await qna.getThread(thread.id, asAuthUser(student));
    expect(asAsker).toMatchObject({ canReply: true, canResolve: true, canDelete: true });

    const asClassmate = await qna.getThread(thread.id, asAuthUser(classmate));
    expect(asClassmate).toMatchObject({ canReply: true, canResolve: false, canDelete: false });

    const asInstructor = await qna.getThread(thread.id, asAuthUser(instructor));
    expect(asInstructor).toMatchObject({ canReply: true, canResolve: true, canDelete: true });

    const asAdmin = await qna.getThread(thread.id, asAuthUser(admin));
    expect(asAdmin).toMatchObject({ canReply: false, canResolve: false, canDelete: true });
  });

  // --- the instructor's inbox ----------------------------------------------

  it('queues only questions still waiting on this instructor', async () => {
    const waiting = await ask();

    const guessedAt = await qna.createThread(courseId, asAuthUser(classmate), {
      title: 'คำถามที่เพื่อนเดาคำตอบให้แล้ว',
      body: 'รายละเอียดของคำถามข้อนี้',
    });
    // A classmate's guess does not take it off the instructor's desk.
    await qna.createReply(guessedAt.id, asAuthUser(student), { body: 'เดาว่าแบบนี้' });

    const answered = await qna.createThread(courseId, asAuthUser(student), {
      title: 'คำถามที่ตอบไปแล้ว',
      body: 'รายละเอียดของคำถามข้อนี้',
    });
    await qna.createReply(answered.id, asAuthUser(instructor), { body: 'ตอบแล้วครับ' });

    const closed = await qna.createThread(courseId, asAuthUser(student), {
      title: 'คำถามที่ผู้ถามปิดเอง',
      body: 'รายละเอียดของคำถามข้อนี้',
    });
    await qna.setResolved(closed.id, asAuthUser(student), {});

    const inbox = await qna.listPendingForInstructor(asAuthUser(instructor), {});

    expect(inbox.total).toBe(2);
    // Oldest first: the question that has waited longest is the one to answer.
    expect(inbox.items[0]?.id).toBe(waiting.id);
    expect(inbox.items[1]?.id).toBe(guessedAt.id);
    expect(inbox.items[0]?.course).toEqual({ id: courseId, title: 'คอร์สถามตอบ' });
  });

  it("never puts another instructor's questions in the queue", async () => {
    const other = await createUser(prisma, { role: 'INSTRUCTOR' });
    await ask();

    expect((await qna.listPendingForInstructor(asAuthUser(other), {})).total).toBe(0);
    expect((await qna.listPendingForInstructor(asAuthUser(instructor), {})).total).toBe(1);
  });
});
