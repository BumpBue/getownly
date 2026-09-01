import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateQuizDto, UpdateQuizDto } from './quiz-request.dto';

const validQuestion = {
  questionText: 'คำถามทดสอบที่ยาวพอสำหรับ validation',
  choices: [
    { choiceText: 'ตัวเลือกที่ถูก', isCorrect: true },
    { choiceText: 'ตัวเลือกที่ผิด', isCorrect: false },
  ],
};

/** Scope 2.3.3: an instructor may only set a pass score between 50 and 100. */
describe('quiz pass score range', () => {
  it('accepts the floor and the ceiling', async () => {
    for (const passScore of [50, 100]) {
      const dto = plainToInstance(CreateQuizDto, {
        title: 'แบบทดสอบทดสอบเกณฑ์ผ่าน',
        passScore,
        questions: [validQuestion],
      });
      expect(await validate(dto)).toHaveLength(0);
    }
  });

  it('rejects a pass score below 50, which used to be allowed', async () => {
    const dto = plainToInstance(CreateQuizDto, {
      title: 'แบบทดสอบทดสอบเกณฑ์ผ่าน',
      passScore: 49,
      questions: [validQuestion],
    });

    const errors = await validate(dto);
    const passScoreError = errors.find((error) => error.property === 'passScore');
    expect(passScoreError?.constraints?.min).toBe('เกณฑ์ผ่านต้องอยู่ระหว่าง 50-100');
  });

  it('rejects a pass score above 100', async () => {
    const dto = plainToInstance(CreateQuizDto, {
      title: 'แบบทดสอบทดสอบเกณฑ์ผ่าน',
      passScore: 101,
      questions: [validQuestion],
    });

    const errors = await validate(dto);
    const passScoreError = errors.find((error) => error.property === 'passScore');
    expect(passScoreError?.constraints?.max).toBe('เกณฑ์ผ่านต้องอยู่ระหว่าง 50-100');
  });

  it('applies the same floor when only passScore is being updated', async () => {
    const dto = plainToInstance(UpdateQuizDto, { passScore: 1 });

    const errors = await validate(dto);
    const passScoreError = errors.find((error) => error.property === 'passScore');
    expect(passScoreError?.constraints?.min).toBe('เกณฑ์ผ่านต้องอยู่ระหว่าง 50-100');
  });
});
