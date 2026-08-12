import { apiRequest } from "@/lib/api-client";
import type { AuthResponse, SelfServiceRole, UserProfile } from "./types";

/**
 * Thin wrappers over the auth endpoints. `skipRefresh` is set wherever a 401
 * is a real answer rather than an expired access token.
 */

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
  displayName: string;
  role: SelfServiceRole;
}

export function register(input: RegisterInput): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: input,
    skipRefresh: true,
  });
}

export function login(identifier: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: { identifier, password },
    skipRefresh: true,
  });
}

export function logout(): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/auth/logout", {
    method: "POST",
    skipRefresh: true,
  });
}

export function me(): Promise<{ user: UserProfile }> {
  return apiRequest<{ user: UserProfile }>("/auth/me");
}

export function forgotPassword(email: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: { email },
    skipRefresh: true,
  });
}

export function resetPassword(token: string, password: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: { token, password },
    skipRefresh: true,
  });
}
