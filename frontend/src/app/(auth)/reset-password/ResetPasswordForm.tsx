"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CheckCircle2, KeyRound } from "lucide-react";
import { AuthFormHeader } from "@/components/shared/AuthFormHeader";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { resetPassword } from "@/lib/auth/api";
import { applyApiError } from "@/lib/auth/form-errors";
import { resetPasswordSchema, type ResetPasswordValues } from "@/lib/auth/schemas";
import { authMessages } from "@/lib/messages/auth";

const FIELDS = ["password", "confirmPassword"] as const;

export function ResetPasswordForm() {
  const t = authMessages.resetPassword;
  const token = useSearchParams().get("token") ?? "";
  const [formError, setFormError] = useState("");
  const [doneMessage, setDoneMessage] = useState("");

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetPasswordValues) {
    setFormError("");
    try {
      const result = await resetPassword(token, values.password);
      setDoneMessage(result.message);
    } catch (error) {
      setFormError(applyApiError(error, setError, FIELDS));
    }
  }

  if (!token) {
    return (
      <>
        <AuthFormHeader icon={AlertTriangle} title={t.title} subtitle={t.missingToken} />
        <div className="grid gap-3">
          <Button asChild block>
            <Link href="/forgot-password">{t.requestNewLink}</Link>
          </Button>
          <Button asChild block variant="outline">
            <Link href="/login">{t.goToLogin}</Link>
          </Button>
        </div>
      </>
    );
  }

  if (doneMessage) {
    return (
      <>
        <AuthFormHeader
          icon={CheckCircle2}
          tone="success"
          align="center"
          title={t.title}
          subtitle={doneMessage}
        />

        <Button asChild block>
          <Link href="/login">{t.goToLogin}</Link>
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
        <Field id="password" label={t.password} error={errors.password?.message}>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder={t.passwordPlaceholder}
            invalid={Boolean(errors.password)}
            {...register("password")}
          />
        </Field>

        <Field id="confirmPassword" label={t.confirmPassword} error={errors.confirmPassword?.message}>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            placeholder={t.confirmPasswordPlaceholder}
            invalid={Boolean(errors.confirmPassword)}
            {...register("confirmPassword")}
          />
        </Field>

        <Button type="submit" block disabled={isSubmitting}>
          {isSubmitting ? t.submitting : t.submit}
        </Button>
      </form>

      <p className="mt-8 border-t border-border pt-6 text-center text-sm">
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          {t.goToLogin}
        </Link>
      </p>
    </>
  );
}
