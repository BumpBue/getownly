import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateCourseDto, UpdateCourseDto } from './course-request.dto';

/**
 * Scope 2.3.1: no course may be priced above 10,000 baht. Exercised at the
 * DTO layer directly, the same layer that decides it in production — a
 * course create/update call never reaches CoursesService with a bad price.
 */
describe('course price ceiling', () => {
  it('accepts a price at exactly the ceiling', async () => {
    const dto = plainToInstance(CreateCourseDto, {
      title: 'คอร์สทดสอบราคาสูงสุด',
      description: 'คำอธิบายคอร์สที่ยาวพอสำหรับการทดสอบ validation ของราคา',
      categoryId: 'category-1',
      price: '10000.00',
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a price one satang above the ceiling', async () => {
    const dto = plainToInstance(CreateCourseDto, {
      title: 'คอร์สทดสอบราคาสูงสุด',
      description: 'คำอธิบายคอร์สที่ยาวพอสำหรับการทดสอบ validation ของราคา',
      categoryId: 'category-1',
      price: '10000.01',
    });

    const errors = await validate(dto);
    const priceError = errors.find((error) => error.property === 'price');
    expect(priceError?.constraints?.maxPriceBaht).toBe('ราคาคอร์สต้องไม่เกิน 10,000 บาท');
  });

  it('rejects an oversized price on update the same way', async () => {
    const dto = plainToInstance(UpdateCourseDto, { price: '99999.99' });

    const errors = await validate(dto);
    const priceError = errors.find((error) => error.property === 'price');
    expect(priceError?.constraints?.maxPriceBaht).toBe('ราคาคอร์สต้องไม่เกิน 10,000 บาท');
  });
});
