"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, KeyRound, Mail, MailCheck } from "lucide-react";
import { AuthFormHeader } from "@/components/shared/AuthFormHeader";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { forgotPassword } from "@/lib/auth/api";
import { applyApiError } from "@/lib/auth/form-errors";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/auth/schemas";
import { authMessages } from "@/lib/messages/auth";

const FIELDS = ["email"] as const;

export function ForgotPasswordForm() {
  const t = authMessages.forgotPassword;
  const [formError, setFormError] = useState("");
  const [sentMessage, setSentMessage] = useState("");

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordValues) {
    setFormError("");
    try {
      const result = await forgotPassword(values.email);
      setSentMessage(result.message);
    } catch (error) {
      setFormError(applyApiError(error, setError, FIELDS));
    }
  }

  // The API answers the same way whether or not the address exists, so this
  // screen deliberately does not confirm that an account was found.
  if (sentMessage) {
    return (
      <>
        <AuthFormHeader
          icon={MailCheck}
          tone="success"
          align="center"
          title={t.checkInbox}
          subtitle={sentMessage}
        />

        <p className="mb-8 text-center text-xs leading-relaxed text-subtle">{t.spamHint}</p>

        <Button asChild block variant="outline">
          <Link href="/login">{t.backToLogin}</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <AuthFormHeader icon={KeyRound} title={t.title} subtitle={t.subtitle} />

      {formError ? (
        <Alert tone="error" className="mb-6">
          {formError}
        </Alert>
      ) : null}

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Field id="email" label={t.email} error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            icon={Mail}
            autoComplete="email"
            placeholder={t.emailPlaceholder}
            invalid={Boolean(errors.email)}
            {...register("email")}
          />
        </Field>

        <Button type="submit" block disabled={isSubmitting}>
          {isSubmitting ? t.submitting : t.submit}
        </Button>
      </form>

      <p className="mt-8 border-t border-border pt-6 text-center text-sm">
        <Link
          href="/login"
          className="group inline-flex items-center gap-1.5 font-medium text-muted transition-colors duration-150 hover:text-primary"
        >
          <ArrowLeft
            aria-hidden
            className="size-4 transition-transform duration-150 group-hover:-translate-x-1"
          />
          {t.backToLogin}
        </Link>
      </p>
    </>
  );
}
