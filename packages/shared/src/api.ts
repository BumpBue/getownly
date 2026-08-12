/**
 * The single response envelope every API error uses.
 * `code` is a stable machine-readable key the frontend branches on.
 * `message` is Thai text that can be shown to the user as-is.
 */
export interface ApiErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, string[]>;
  timestamp: string;
  path: string;
}

/** Money always crosses the wire as a fixed-point string, never a JS number. */
export type MoneyString = string;

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
