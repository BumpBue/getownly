import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * A quiz arrives whole: title, pass mark and every question with every choice
 * in one payload. There is no endpoint for editing a single question, because
 * a quiz that has been sat cannot be edited at all — and one that has not can
 * simply be sent again.
 */

const MAX_QUESTIONS = 50;
const MAX_CHOICES = 6;

export class QuizChoiceInputDto {
  @IsString()
  @MinLength(1, { message: 'ตัวเลือกต้องไม่เป็นค่าว่าง' })
  @MaxLength(300, { message: 'ตัวเลือกต้องยาวไม่เกิน 300 ตัวอักษร' })
  choiceText!: string;

  /** Exactly one choice per question must be true; the service enforces that. */
  @IsBoolean({ message: 'ต้องระบุว่าตัวเลือกนี้ถูกหรือผิด' })
  isCorrect!: boolean;
}

export class QuizQuestionInputDto {
  @IsString()
  @MinLength(5, { message: 'คำถามต้องยาวอย่างน้อย 5 ตัวอักษร' })
  @MaxLength(500, { message: 'คำถามต้องยาวไม่เกิน 500 ตัวอักษร' })
  questionText!: string;

  @IsArray({ message: 'ตัวเลือกต้องเป็นรายการ' })
  @ArrayMinSize(2, { message: 'แต่ละข้อต้องมีตัวเลือกอย่างน้อย 2 ตัวเลือก' })
  @ArrayMaxSize(MAX_CHOICES, { message: `แต่ละข้อมีตัวเลือกได้ไม่เกิน ${MAX_CHOICES} ตัวเลือก` })
  @ValidateNested({ each: true })
  @Type(() => QuizChoiceInputDto)
  choices!: QuizChoiceInputDto[];
}

export class CreateQuizDto {
  @IsString()
  @MinLength(3, { message: 'ชื่อแบบทดสอบต้องยาวอย่างน้อย 3 ตัวอักษร' })
  @MaxLength(150, { message: 'ชื่อแบบทดสอบต้องยาวไม่เกิน 150 ตัวอักษร' })
  title!: string;

  /** Percentage needed to pass. */
  @Type(() => Number)
  @IsInt({ message: 'เกณฑ์ผ่านต้องเป็นจำนวนเต็ม' })
  @Min(1, { message: 'เกณฑ์ผ่านต้องมากกว่า 0' })
  @Max(100, { message: 'เกณฑ์ผ่านต้องไม่เกิน 100' })
  passScore!: number;

  @IsArray({ message: 'ข้อสอบต้องเป็นรายการ' })
  @ArrayMinSize(1, { message: 'แบบทดสอบต้องมีอย่างน้อย 1 ข้อ' })
  @ArrayMaxSize(MAX_QUESTIONS, { message: `แบบทดสอบมีได้ไม่เกิน ${MAX_QUESTIONS} ข้อ` })
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionInputDto)
  questions!: QuizQuestionInputDto[];
}

export class UpdateQuizDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'ชื่อแบบทดสอบต้องยาวอย่างน้อย 3 ตัวอักษร' })
  @MaxLength(150, { message: 'ชื่อแบบทดสอบต้องยาวไม่เกิน 150 ตัวอักษร' })
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'เกณฑ์ผ่านต้องเป็นจำนวนเต็ม' })
  @Min(1, { message: 'เกณฑ์ผ่านต้องมากกว่า 0' })
  @Max(100, { message: 'เกณฑ์ผ่านต้องไม่เกิน 100' })
  passScore?: number;

  /** When present, replaces every question. Omit it to edit only the header. */
  @IsOptional()
  @IsArray({ message: 'ข้อสอบต้องเป็นรายการ' })
  @ArrayMinSize(1, { message: 'แบบทดสอบต้องมีอย่างน้อย 1 ข้อ' })
  @ArrayMaxSize(MAX_QUESTIONS, { message: `แบบทดสอบมีได้ไม่เกิน ${MAX_QUESTIONS} ข้อ` })
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionInputDto)
  questions?: QuizQuestionInputDto[];
}

export class QuizAnswerInputDto {
  @IsString()
  questionId!: string;

  @IsString()
  choiceId!: string;
}

export class SubmitQuizDto {
  /** One answer per question, no more and no fewer. */
  @IsArray({ message: 'คำตอบต้องเป็นรายการ' })
  @ArrayMinSize(1, { message: 'กรุณาตอบอย่างน้อย 1 ข้อ' })
  @ArrayMaxSize(MAX_QUESTIONS, { message: 'จำนวนคำตอบเกินกว่าที่ระบบรองรับ' })
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerInputDto)
  answers!: QuizAnswerInputDto[];
}
