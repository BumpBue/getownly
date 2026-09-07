import { QUIZ_PASS_SCORE_MAX, QUIZ_PASS_SCORE_MIN } from '@getownly/shared';
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

/**
 * ทก.01 A7: an instructor may only set a pass mark between 60 and 100.
 *
 * The bounds are read from @getownly/shared rather than typed out again, so
 * changing the scope constant moves the DTO and this test together instead of
 * leaving one of them asserting the old rule.
 */
const RANGE_MESSAGE = `เกณฑ์ผ่านต้องอยู่ระหว่าง ${QUIZ_PASS_SCORE_MIN}-${QUIZ_PASS_SCORE_MAX}`;

function createDto(passScore: number): CreateQuizDto {
  return plainToInstance(CreateQuizDto, {
    title: 'แบบทดสอบทดสอบเกณฑ์ผ่าน',
    passScore,
    questions: [validQuestion],
  });
}

describe('quiz pass score range', () => {
  it('accepts the floor and the ceiling', async () => {
    for (const passScore of [QUIZ_PASS_SCORE_MIN, QUIZ_PASS_SCORE_MAX]) {
      expect(await validate(createDto(passScore))).toHaveLength(0);
    }
  });

  it('rejects a pass score one below the floor', async () => {
    const errors = await validate(createDto(QUIZ_PASS_SCORE_MIN - 1));
    const passScoreError = errors.find((error) => error.property === 'passScore');
    expect(passScoreError?.constraints?.min).toBe(RANGE_MESSAGE);
  });

  it('rejects 50, which the previous scope allowed', async () => {
    const errors = await validate(createDto(50));
    const passScoreError = errors.find((error) => error.property === 'passScore');
    expect(passScoreError?.constraints?.min).toBe(RANGE_MESSAGE);
  });

  it('rejects a pass score above the ceiling', async () => {
    const errors = await validate(createDto(QUIZ_PASS_SCORE_MAX + 1));
    const passScoreError = errors.find((error) => error.property === 'passScore');
    expect(passScoreError?.constraints?.max).toBe(RANGE_MESSAGE);
  });

  it('applies the same floor when only passScore is being updated', async () => {
    const dto = plainToInstance(UpdateQuizDto, { passScore: 1 });

    const errors = await validate(dto);
    const passScoreError = errors.find((error) => error.property === 'passScore');
    expect(passScoreError?.constraints?.min).toBe(RANGE_MESSAGE);
  });
});
