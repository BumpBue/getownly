import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

/**
 * Every error leaves the API in exactly this shape.
 *
 * `code` is a stable English identifier the frontend branches on, `message` is
 * Thai and can be shown to the user as-is, and `errors` carries per-field
 * validation problems when there are any.
 */
export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  errors?: Record<string, string[]>;
  /**
   * Machine-readable context attached by a BusinessException, e.g. the list of
   * fields still missing before a course can be submitted, or the size limit a
   * file exceeded. Always safe to show: it is written by us, not by Prisma.
   */
  details?: Record<string, unknown>;
  timestamp: string;
  path: string;
}

const THAI_MESSAGE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'คำขอไม่ถูกต้อง',
  [HttpStatus.UNAUTHORIZED]: 'กรุณาเข้าสู่ระบบก่อนใช้งาน',
  [HttpStatus.FORBIDDEN]: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้',
  [HttpStatus.NOT_FOUND]: 'ไม่พบข้อมูลที่ต้องการ',
  [HttpStatus.CONFLICT]: 'ข้อมูลนี้ถูกใช้งานไปแล้ว',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'ไฟล์หรือข้อมูลที่ส่งมามีขนาดใหญ่เกินกำหนด',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'ไม่สามารถดำเนินการตามคำขอนี้ได้',
  [HttpStatus.TOO_MANY_REQUESTS]: 'คุณทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง',
};

/** At or above this, the client sees a generic message and we log the real one. */
const SERVER_ERROR_FLOOR = 500;

const CODE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const body = this.toErrorBody(exception, request.url);

    if (body.statusCode >= SERVER_ERROR_FLOOR) {
      // Log the real thing here; the client only ever sees the generic text.
      this.logger.error(
        `${request.method} ${request.url} -> ${body.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(body.statusCode).json(body);
  }

  private toErrorBody(exception: unknown, path: string): ApiErrorBody {
    const timestamp = new Date().toISOString();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'object' && payload !== null) {
        const record = payload as Record<string, unknown>;
        return {
          statusCode: status,
          code: asString(record.code) ?? CODE_BY_STATUS[status] ?? 'ERROR',
          message: asString(record.message) ?? defaultMessage(status),
          ...(isFieldErrors(record.errors) ? { errors: record.errors } : {}),
          ...(isDetails(record.details) ? { details: record.details } : {}),
          timestamp,
          path,
        };
      }

      return {
        statusCode: status,
        code: CODE_BY_STATUS[status] ?? 'ERROR',
        message: defaultMessage(status),
        timestamp,
        path,
      };
    }

    // Prisma errors carry table and column names, so they never reach the client.
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const status =
        exception.code === 'P2002' ? HttpStatus.CONFLICT : HttpStatus.INTERNAL_SERVER_ERROR;
      this.logger.error(`Prisma ${exception.code} on ${path}`, exception.message);
      return {
        statusCode: status,
        code: exception.code === 'P2002' ? 'CONFLICT' : 'INTERNAL_SERVER_ERROR',
        message: defaultMessage(status),
        timestamp,
        path,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: defaultMessage(HttpStatus.INTERNAL_SERVER_ERROR),
      timestamp,
      path,
    };
  }
}

function defaultMessage(status: number): string {
  return THAI_MESSAGE_BY_STATUS[status] ?? THAI_MESSAGE_BY_STATUS[HttpStatus.INTERNAL_SERVER_ERROR];
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Only a BusinessException sets `details`, and only with values it chose, so
 * a plain object check is enough. A Prisma or framework error never gets here
 * with one attached.
 */
function isDetails(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFieldErrors(value: unknown): value is Record<string, string[]> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (entry) => Array.isArray(entry) && entry.every((item) => typeof item === 'string'),
    )
  );
}
