import { cookies } from "next/headers";

/**
 * How Server Components read from the API.
 *
 * Different from `api-client.ts` in two ways that matter: it forwards the
 * request's cookies by hand (the browser is not the one making this call), and
 * it never tries to refresh an expired session, because a Server Component has
 * nowhere to put the new cookie. A 401 here simply means "render this as a
 * guest would see it" — which is exactly what the public catalog wants.
 */

const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

export interface ServerFetchResult<T> {
  data: T | null;
  /** HTTP status, or 0 when the API could not be reached at all. */
  status: number;
  /** Thai message from the API's error envelope, when there was one. */
  message: string | null;
}

export async function serverFetch<T>(path: string): Promise<ServerFetchResult<T>> {
  const cookieHeader = (await cookies()).toString();

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      // Catalog data changes whenever an admin approves a course, and prices
      // must never be served stale.
      cache: "no-store",
    });
  } catch {
    return { data: null, status: 0, message: null };
  }

  if (!response.ok) {
    return {
      data: null,
      status: response.status,
      message: await readErrorMessage(response),
    };
  }

  return { data: (await response.json()) as T, status: response.status, message: null };
}

async function readErrorMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { message?: unknown };
    return typeof body.message === "string" ? body.message : null;
  } catch {
    return null;
  }
}
