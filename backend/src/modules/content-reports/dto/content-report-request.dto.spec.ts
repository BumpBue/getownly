import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateContentReportDto, ReviewContentReportDto } from './content-report-request.dto';

describe('CreateContentReportDto', () => {
  it('accepts a valid course report', async () => {
    const dto = plainToInstance(CreateContentReportDto, {
      targetType: 'COURSE',
      targetId: 'course-1',
      reason: 'เนื้อหาไม่ตรงกับที่โฆษณาไว้เลยสักนิด',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a target type that is not COURSE or QNA_THREAD', async () => {
    const dto = plainToInstance(CreateContentReportDto, {
      targetType: 'REVIEW',
      targetId: 'course-1',
      reason: 'เนื้อหาไม่ตรงกับที่โฆษณาไว้เลยสักนิด',
    });
    const errors = await validate(dto);
    expect(errors.find((error) => error.property === 'targetType')).toBeDefined();
  });

  it('rejects a reason shorter than 10 characters', async () => {
    const dto = plainToInstance(CreateContentReportDto, {
      targetType: 'COURSE',
      targetId: 'course-1',
      reason: 'สั้นไป',
    });
    const errors = await validate(dto);
    expect(errors.find((error) => error.property === 'reason')).toBeDefined();
  });
});

describe('ReviewContentReportDto', () => {
  it('accepts a decision with no suspendCourse flag', async () => {
    const dto = plainToInstance(ReviewContentReportDto, { status: 'DISMISSED' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a status other than REVIEWED or DISMISSED', async () => {
    const dto = plainToInstance(ReviewContentReportDto, { status: 'PENDING' });
    const errors = await validate(dto);
    expect(errors.find((error) => error.property === 'status')).toBeDefined();
  });
});
