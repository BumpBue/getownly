import type { Metadata } from "next";
import { RegisterForm } from "./RegisterForm";
import { authMessages } from "@/lib/messages/auth";

export const metadata: Metadata = {
  title: authMessages.register.title,
};

export default function RegisterPage() {
  return <RegisterForm />;
}
