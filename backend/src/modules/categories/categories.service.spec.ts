import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '@/infra/prisma.service';
import { CategoriesService } from './categories.service';
import { createCourse, createUser, resetDatabase, type TestUser } from '../../../test/factories';

describe('CategoriesService', () => {
  let prisma: PrismaService;
  let categories: CategoriesService;
  let instructor: TestUser;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    categories = new CategoriesService(prisma);
    instructor = await createUser(prisma, { role: 'INSTRUCTOR' });
  });

  it('creates a category and gives it a URL-safe slug when none is offered', async () => {
    const created = await categories.create({ name: 'การตลาดออนไลน์' });

    expect(created.name).toBe('การตลาดออนไลน์');
    // Guessing at romanising Thai would bake a wrong guess into a public URL.
    expect(created.slug).toMatch(/^category-[0-9a-f]{8}$/);
    expect(created.totalCourseCount).toBe(0);
  });

  it('keeps a slug the admin chose', async () => {
    const created = await categories.create({ name: 'ถ่ายภาพ', slug: 'photography' });

    expect(created.slug).toBe('photography');
  });

  it('refuses a duplicate name or slug as a conflict, not a database error', async () => {
    await categories.create({ name: 'ถ่ายภาพ', slug: 'photography' });

    await expect(
      categories.create({ name: 'ถ่ายภาพ', slug: 'photography-2' }),
    ).rejects.toMatchObject({ code: 'CATEGORY_NAME_TAKEN' });

    await expect(
      categories.create({ name: 'ถ่ายภาพขั้นสูง', slug: 'photography' }),
    ).rejects.toMatchObject({ code: 'CATEGORY_NAME_TAKEN' });
  });

  it('renames a category', async () => {
    const created = await categories.create({ name: 'ชื่อเดิม' });

    const updated = await categories.update(created.id, { name: 'ชื่อใหม่' });

    expect(updated.name).toBe('ชื่อใหม่');
    expect(updated.id).toBe(created.id);
  });

  it('counts published courses separately from every course', async () => {
    const created = await categories.create({ name: 'หมวดที่มีคอร์ส' });
    await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId: created.id,
      price: '0.00',
    });
    await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId: created.id,
      price: '0.00',
      status: 'DRAFT',
    });

    const [row] = await categories.listForAdmin();
    expect(row?.courseCount).toBe(1);
    expect(row?.totalCourseCount).toBe(2);

    // The public list only ever counts what a visitor could actually open.
    const [publicRow] = await categories.listAll();
    expect(publicRow?.courseCount).toBe(1);
  });

  it('deletes an empty category', async () => {
    const created = await categories.create({ name: 'หมวดที่ว่างเปล่า' });

    await categories.remove(created.id);

    expect(await prisma.category.count({ where: { id: created.id } })).toBe(0);
  });

  it('refuses to delete a category that still holds courses, drafts included', async () => {
    const created = await categories.create({ name: 'หมวดที่มีคอร์สอยู่' });
    await createCourse(prisma, {
      instructorId: instructor.id,
      categoryId: created.id,
      price: '0.00',
      status: 'DRAFT',
    });

    await expect(categories.remove(created.id)).rejects.toMatchObject({
      code: 'CATEGORY_IN_USE',
    });
  });

  it('answers 404 for a category that does not exist', async () => {
    await expect(categories.remove('does-not-exist')).rejects.toMatchObject({
      code: 'CATEGORY_NOT_FOUND',
    });
    await expect(categories.update('does-not-exist', { name: 'ชื่อใหม่' })).rejects.toMatchObject({
      code: 'CATEGORY_NOT_FOUND',
    });
  });
});
