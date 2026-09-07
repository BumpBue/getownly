import { COURSE_MAX_PRICE_BAHT } from '@getownly/shared';
import { z } from 'zod';
import { instructorMessages } from '@/lib/messages/instructor';

/**
 * Client-side validation, for UX only.
 *
 * Every rule here also exists on the backend DTO, which is what actually
 * decides (CLAUDE.md, "Validation"). These bounds must stay in step with
 * backend/src/modules/courses/dto/course-request.dto.ts.
 */
const { validation } = instructorMessages;

/** Digits with at most two decimals — the same shape the API accepts. */
const pricePattern = /^\d{1,8}(\.\d{1,2})?$/;

// COURSE_MAX_PRICE_BAHT comes from @getownly/shared, the same constant the
// API's CreateCourseDto validates against. Never re-declare it here.

export const courseFormSchema = z.object({
  title: z
    .string()
    .min(1, validation.titleRequired)
    .min(6, validation.titleTooShort)
    .max(150, validation.titleTooLong),
  description: z
    .string()
    .min(1, validation.descriptionRequired)
    .min(20, validation.descriptionTooShort)
    .max(5000, validation.descriptionTooLong),
  categoryId: z.string().min(1, validation.categoryRequired),
  price: z
    .string()
    .regex(pricePattern, validation.priceInvalid)
    .refine((value) => Number(value) <= COURSE_MAX_PRICE_BAHT, validation.priceTooHigh),
});

export type CourseFormValues = z.infer<typeof courseFormSchema>;

export const lessonTitleSchema = z
  .string()
  .min(1, validation.lessonTitleRequired)
  .min(3, validation.lessonTitleTooShort);
