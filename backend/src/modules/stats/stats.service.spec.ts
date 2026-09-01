import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '@/infra/prisma.service';
import { StatsService } from './stats.service';
import {
  createCategory,
  createCourse,
  createUser,
  enrol,
  resetDatabase,
} from '../../../test/factories';

describe('StatsService', () => {
  let prisma: PrismaService;
  let stats: StatsService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    stats = new StatsService(prisma);
  });

  it('reports zero for both counts on an empty database rather than erroring', async () => {
    await expect(stats.publicStats()).resolves.toEqual({ courseCount: 0, studentCount: 0 });
  });

  it('counts only published courses', async () => {
    const instructor = await createUser(prisma, { role: 'INSTRUCTOR' });
    const categoryId = await createCategory(prisma);
    await createCourse(prisma, { instructorId: instructor.id, categoryId, price: '0.00' });
    await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '0.00',
      status: 'DRAFT',
    });

    await expect(stats.publicStats()).resolves.toMatchObject({ courseCount: 1 });
  });

  it('counts each enrolled student once, even across several courses', async () => {
    const instructor = await createUser(prisma, { role: 'INSTRUCTOR' });
    const student = await createUser(prisma, { role: 'STUDENT' });
    const categoryId = await createCategory(prisma);
    const courseA = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '0.00',
    });
    const courseB = await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId,
      price: '0.00',
    });
    await enrol(prisma, { courseId: courseA, studentId: student.id });
    await enrol(prisma, { courseId: courseB, studentId: student.id });

    await expect(stats.publicStats()).resolves.toMatchObject({ studentCount: 1 });
  });
});
