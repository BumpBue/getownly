import { Suspense } from "react";
import type { Metadata } from "next";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { AuthFormSkeleton } from "@/components/shared/AuthFormSkeleton";
import { authMessages } from "@/lib/messages/auth";

export const metadata: Metadata = {
  title: authMessages.resetPassword.title,
};

export default function ResetPasswordPage() {
  // The token arrives in the query string, so the form can only be decided on
  // the client. The skeleton keeps the pane from being blank until then.
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
