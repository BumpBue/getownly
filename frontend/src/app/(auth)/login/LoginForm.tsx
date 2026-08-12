"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthFormHeader } from "@/components/shared/AuthFormHeader";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { login } from "@/lib/auth/api";
import { applyApiError } from "@/lib/auth/form-errors";
import { loginSchema, type LoginValues } from "@/lib/auth/schemas";
import { HOME_PATH_BY_ROLE } from "@/lib/auth/types";
import { authMessages } from "@/lib/messages/auth";

const FIELDS = ["identifier", "password"] as const;

export function LoginForm() {
  const t = authMessages.login;
  const router = useRouter();
  const [formError, setFormError] = useState("");

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setFormError("");
    try {
      const { user } = await login(values.identifier, values.password);

      // Read at submit time rather than with useSearchParams, which would make
      // the whole form client-only and leave the pane blank until hydration.
      const next = new URLSearchParams(window.location.search).get("next");
      // A leading "//" would be a protocol-relative URL, so only a single
      // slash counts as same-site: ?next= cannot bounce the user off-site.
      const destination =
        next !== null && next.startsWith("/") && !next.startsWith("//")
          ? next
          : HOME_PATH_BY_ROLE[user.role];

      router.replace(destination);
      router.refresh();
    } catch (error) {
      setFormError(applyApiError(error, setError, FIELDS));
    }
  }

  return (
    <>
      <AuthFormHeader title={t.title} subtitle={t.subtitle} />

      {formError ? (
        <Alert tone="error" className="mb-6">
          {formError}
        </Alert>
      ) : null}

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Field id="identifier" label={t.identifier} error={errors.identifier?.message}>
          <Input
            id="identifier"
            autoComplete="username"
            placeholder={t.identifierPlaceholder}
            invalid={Boolean(errors.identifier)}
            {...register("identifier")}
          />
        </Field>

        <Field id="password" label={t.password} error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder={t.passwordPlaceholder}
            invalid={Boolean(errors.password)}
            {...register("password")}
          />
        </Field>

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {t.forgot}
          </Link>
        </div>

        <Button type="submit" block disabled={isSubmitting}>
          {isSubmitting ? t.submitting : t.submit}
        </Button>
      </form>

      <p className="mt-8 border-t border-border pt-6 text-center text-sm text-muted">
        {t.noAccount}{" "}
        <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
          {t.register}
        </Link>
      </p>
    </>
  );
}
