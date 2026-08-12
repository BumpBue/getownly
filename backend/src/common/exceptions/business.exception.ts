import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base class for every error the client is allowed to see.
 *
 * `code` is a stable English identifier the frontend branches on.
 * `message` is Thai and can be rendered to the user as-is.
 * The global exception filter (phase 3) reshapes this into
 * `{ statusCode, code, message, details?, timestamp, path }`.
 */
export class BusinessException extends HttpException {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    status: HttpStatus,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super({ code, message, ...(details ? { details } : {}) }, status);
    this.code = code;
    this.details = details;
  }
}
