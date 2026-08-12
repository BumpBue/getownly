import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "@/lib/api-client";
import { authMessages } from "@/lib/messages/auth";

/**
 * Moves a failed request onto the form.
 *
 * Per-field problems from the backend's `errors` map land on the matching
 * input; anything else becomes a single banner message, which is returned.
 */
export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields: readonly Path<T>[],
): string {
  if (!(error instanceof ApiError)) {
    return authMessages.errors.unexpected;
  }

  let matchedAnyField = false;

  for (const [field, messages] of Object.entries(error.errors ?? {})) {
    if ((knownFields as readonly string[]).includes(field) && messages[0]) {
      setError(field as Path<T>, { type: "server", message: messages[0] });
      matchedAnyField = true;
    }
  }

  // A conflict names the field it is about, so it reads better next to it.
  if (error.code === "EMAIL_ALREADY_USED" && (knownFields as readonly string[]).includes("email")) {
    setError("email" as Path<T>, { type: "server", message: error.message });
    return "";
  }
  if (
    error.code === "USERNAME_ALREADY_USED" &&
    (knownFields as readonly string[]).includes("username")
  ) {
    setError("username" as Path<T>, { type: "server", message: error.message });
    return "";
  }

  return matchedAnyField ? "" : error.message;
}
