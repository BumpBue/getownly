"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { AuthFormHeader } from "@/components/shared/AuthFormHeader";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { register as registerAccount } from "@/lib/auth/api";
import { applyApiError } from "@/lib/auth/form-errors";
import { registerSchema, type RegisterValues } from "@/lib/auth/schemas";
import { HOME_PATH_BY_ROLE, type SelfServiceRole } from "@/lib/auth/types";
import { authMessages } from "@/lib/messages/auth";
import { RoleCards } from "./RoleCards";

const FIELDS = ["displayName", "email", "username", "password", "confirmPassword"] as const;

export function RegisterForm() {
  const t = authMessages.register;
  const router = useRouter();
  const [role, setRole] = useState<SelfServiceRole | null>(null);
  const [formError, setFormError] = useState("");

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: "STUDENT",
      displayName: "",
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: RegisterValues) {
    if (!role) return;
    setFormError("");

    try {
      const { user } = await registerAccount({
        email: values.email,
        username: values.username,
        password: values.password,
        displayName: values.displayName,
        role,
      });

      router.replace(HOME_PATH_BY_ROLE[user.role]);
      router.refresh();
    } catch (error) {
      setFormError(applyApiError(error, setError, FIELDS));
    }
  }

  if (!role) {
    return (
      <>
        <AuthFormHeader title={t.roleStepTitle} subtitle={t.roleStepSubtitle} />
        <RoleCards onSelect={setRole} />

        <p className="mt-8 border-t border-border pt-6 text-center text-sm text-muted">
          {t.haveAccount}{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            {t.login}
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <AuthFormHeader title={t.title} subtitle={t.subtitle} />

      <div className="mb-6 flex items-center justify-between rounded-control border border-border bg-background px-4 py-3">
        <span className="text-sm text-muted">
          {t.selectedRolePrefix}{" "}
          <span className="font-medium text-foreground">{t.roles[role].title}</span>
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={() => setRole(null)}>
          {t.changeRole}
          <ArrowRight aria-hidden className="rotate-180" />
        </Button>
      </div>

      {formError ? (
        <Alert tone="error" className="mb-6">
          {formError}
        </Alert>
      ) : null}

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Field id="displayName" label={t.displayName} error={errors.displayName?.message}>
          <Input
            id="displayName"
            autoComplete="name"
            placeholder={t.displayNamePlaceholder}
            invalid={Boolean(errors.displayName)}
            {...register("displayName")}
          />
        </Field>

        <Field id="email" label={t.email} error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t.emailPlaceholder}
            invalid={Boolean(errors.email)}
            {...register("email")}
          />
        </Field>

        <Field
          id="username"
          label={t.username}
          error={errors.username?.message}
          hint={t.usernamePlaceholder}
        >
          <Input
            id="username"
            autoComplete="username"
            invalid={Boolean(errors.username)}
            {...register("username")}
          />
        </Field>

        <Field id="password" label={t.password} error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder={t.passwordPlaceholder}
            invalid={Boolean(errors.password)}
            {...register("password")}
          />
        </Field>

        <Field id="confirmPassword" label={t.confirmPassword} error={errors.confirmPassword?.message}>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder={t.confirmPasswordPlaceholder}
            invalid={Boolean(errors.confirmPassword)}
            {...register("confirmPassword")}
          />
        </Field>

        <Button type="submit" block disabled={isSubmitting}>
          {isSubmitting ? t.submitting : t.submit}
        </Button>

        <p className="text-center text-xs leading-relaxed text-subtle">{t.terms}</p>
      </form>

      <p className="mt-8 border-t border-border pt-6 text-center text-sm text-muted">
        {t.haveAccount}{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          {t.login}
        </Link>
      </p>
    </>
  );
}
