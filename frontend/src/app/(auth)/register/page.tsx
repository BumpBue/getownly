import type { Metadata } from "next";
import { RegisterForm } from "./RegisterForm";
import { authMessages } from "@/lib/messages/auth";
import { SELF_SERVICE_ROLES, type SelfServiceRole } from "@/lib/auth/types";

export const metadata: Metadata = {
  title: authMessages.register.title,
};

/**
 * `?role=instructor` (from the landing page's "เปิดสอนกับเรา" links) skips
 * straight past the role-picker step. Read server-side, not with
 * useSearchParams, so this page keeps rendering on the server.
 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = params.role;
  const role = (Array.isArray(requested) ? requested[0] : requested)?.toUpperCase();
  const initialRole = SELF_SERVICE_ROLES.includes(role as SelfServiceRole)
    ? (role as SelfServiceRole)
    : null;

  return <RegisterForm initialRole={initialRole} />;
}
