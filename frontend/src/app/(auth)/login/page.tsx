import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";
import { authMessages } from "@/lib/messages/auth";

export const metadata: Metadata = {
  title: authMessages.login.title,
};

export default function LoginPage() {
  return <LoginForm />;
}
