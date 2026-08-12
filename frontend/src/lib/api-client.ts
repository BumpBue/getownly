import { authMessages } from "@/lib/messages/auth";

/**
 * The one way the browser talks to the API.
 *
 * Tokens live in httpOnly cookies, so nothing here reads or stores a token:
 * `credentials: "include"` is the whole mechanism. When a call comes back 401
 * the client rotates the refresh token once and retries, so a 15-minute access
 * token expiring mid-session is invisible to the user.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

/**
 * Absolute URL of an API route, for the few things that cannot go through
 * `apiRequest`: a `<video src>` is fetched by the browser itself, not by us.
 */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

/** Mirrors the shape the backend's global exception filter always returns. */
export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  errors?: Record<string, string[]>;
  /** Context the API attached, e.g. `{ missing: [...] }` on COURSE_INCOMPLETE. */
  details?: Record<string, unknown>;
  timestamp: string;
  path: string;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly errors?: Record<string, string[]>;
  readonly details?: Record<string, unknown>;

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.statusCode = body.statusCode;
    this.code = body.code;
    this.errors = body.errors;
    this.details = body.details;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Set on the auth endpoints themselves, so a 401 there is not retried. */
  skipRefresh?: boolean;
  signal?: AbortSignal;
}

/** Shared across callers so ten parallel 401s rotate the token once, not ten times. */
let inFlightRefresh: Promise<boolean> | null = null;

async function rawFetch(path: string, options: RequestOptions): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
}

/**
 * Rotates the session once, sharing one attempt between every caller.
 *
 * Exported because the video player needs it too: the browser fetches
 * `<video src>` on its own, so a 401 halfway through a lesson never reaches
 * the retry built into `apiRequest`.
 */
export async function refreshSession(): Promise<boolean> {
  inFlightRefresh ??= (async () => {
    try {
      const response = await rawFetch("/auth/refresh", { method: "POST" });
      return response.ok;
    } catch {
      return false;
    } finally {
      // Cleared on the next tick so everyone awaiting this attempt sees the
      // same answer before a new attempt can start.
      queueMicrotask(() => {
        inFlightRefresh = null;
      });
    }
  })();

  return inFlightRefresh;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;

  try {
    response = await rawFetch(path, options);
  } catch {
    throw new ApiError({
      statusCode: 0,
      code: "NETWORK_ERROR",
      message: authMessages.errors.network,
      timestamp: new Date().toISOString(),
      path,
    });
  }

  if (response.status === 401 && !options.skipRefresh) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await rawFetch(path, options);
    }
  }

  if (!response.ok) {
    throw new ApiError(await readErrorBody(response, path));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function readErrorBody(response: Response, path: string): Promise<ApiErrorBody> {
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    if (typeof body.message === "string" && typeof body.code === "string") {
      return {
        statusCode: body.statusCode ?? response.status,
        code: body.code,
        message: body.message,
        errors: body.errors,
        details: body.details,
        timestamp: body.timestamp ?? new Date().toISOString(),
        path: body.path ?? path,
      };
    }
  } catch {
    // Falls through to the generic message below.
  }

  return {
    statusCode: response.status,
    code: "UNEXPECTED_ERROR",
    message: authMessages.errors.unexpected,
    timestamp: new Date().toISOString(),
    path,
  };
}
