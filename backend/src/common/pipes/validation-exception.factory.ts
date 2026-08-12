import { BadRequestException, ValidationError } from '@nestjs/common';

/**
 * Turns class-validator output into the `errors` map of the standard error
 * body: one entry per field, each holding the Thai messages for that field.
 */
export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  return new BadRequestException({
    code: 'VALIDATION_FAILED',
    message: 'ข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง',
    errors: flattenValidationErrors(errors),
  });
}

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const error of errors) {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;

    const messages = Object.values(error.constraints ?? {});
    if (messages.length > 0) {
      result[path] = messages;
    }

    if (error.children && error.children.length > 0) {
      Object.assign(result, flattenValidationErrors(error.children, path));
    }
  }

  return result;
}
