import { z } from "zod";
import { authMessages } from "@/lib/messages/auth";
import { SELF_SERVICE_ROLES } from "./types";

/**
 * Client-side validation, for feedback only. The backend validates the same
 * rules again and is the one that decides (CLAUDE.md, หัวข้อ 5).
 */
const v = authMessages.validation;

const password = z
  .string()
  .min(1, v.passwordRequired)
  .min(8, v.passwordTooShort)
  .max(72, v.passwordTooLong)
  .regex(/(?=.*[A-Za-z])(?=.*\d)/, v.passwordPattern);

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, v.identifierRequired),
  password: z.string().min(1, v.passwordRequired),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    role: z.enum(SELF_SERVICE_ROLES, { message: v.roleRequired }),
    displayName: z
      .string()
      .trim()
      .min(1, v.displayNameRequired)
      .min(2, v.displayNameTooShort)
      .max(80, v.displayNameTooLong),
    email: z.string().trim().min(1, v.emailRequired).email(v.emailInvalid),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, v.usernameRequired)
      .min(3, v.usernameTooShort)
      .max(30, v.usernameTooLong)
      .regex(/^[a-z0-9._]+$/, v.usernamePattern),
    password,
    confirmPassword: z.string().min(1, v.passwordRequired),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: v.confirmPasswordMismatch,
  });
export type RegisterValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, v.emailRequired).email(v.emailInvalid),
});
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string().min(1, v.passwordRequired),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: v.confirmPasswordMismatch,
  });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
