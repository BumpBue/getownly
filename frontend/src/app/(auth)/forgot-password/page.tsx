import type { Metadata } from "next";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { authMessages } from "@/lib/messages/auth";

export const metadata: Metadata = {
  title: authMessages.forgotPassword.title,
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
