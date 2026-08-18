"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { AuthFormHeader } from "@/components/shared/AuthFormHeader";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { register as registerAccount } from "@/lib/auth/api";
import { applyApiError } from "@/lib/auth/form-errors";
import { registerSchema, type RegisterValues } from "@/lib/auth/schemas";
import { HOME_PATH_BY_ROLE, type SelfServiceRole } from "@/lib/auth/types";
import { authMessages } from "@/lib/messages/auth";
import { cn } from "@/lib/utils";
import { RoleCards } from "./RoleCards";

const FIELDS = ["displayName", "email", "username", "password", "confirmPassword"] as const;

/**
 * The design's two-segment progress rail. Registration is the only flow in
 * the app that asks for something before it will show the real form, so it is
 * the only one that has to promise the wait is short.
 */
function RegisterProgress({ step }: { step: 1 | 2 }) {
  const t = authMessages.register;

  return (
    <div
      className="mb-8 flex items-center gap-2"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={2}
      aria-valuenow={step}
      aria-label={t.progressLabel}
    >
      <span className="h-1 flex-1 rounded-full bg-secondary" />
      <span className={cn("h-1 flex-1 rounded-full", step === 2 ? "bg-secondary" : "bg-border")} />
    </div>
  );
}

export function RegisterForm({ initialRole = null }: { initialRole?: SelfServiceRole | null }) {
  const t = authMessages.register;
  const router = useRouter();
  const [role, setRole] = useState<SelfServiceRole | null>(initialRole);
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
        <RegisterProgress step={1} />
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
      <RegisterProgress step={2} />

      {/*
        The design's back arrow sits above the step-two heading. It keeps the
        chosen role in the label rather than saying a bare "ย้อนกลับ", so the
        one thing already decided stays visible while the rest is filled in.
      */}
      <button
        type="button"
        onClick={() => setRole(null)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <ArrowLeft aria-hidden className="size-4" />
        <span>
          {t.selectedRolePrefix} <span className="font-medium">{t.roles[role].title}</span> ·{" "}
          {t.changeRole}
        </span>
      </button>

      <AuthFormHeader title={t.title} subtitle={t.subtitle} />

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
