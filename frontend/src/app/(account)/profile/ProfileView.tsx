"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Check, KeyRound, Save, ServerCrash } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/EmptyState";
import { ApiError } from "@/lib/api-client";
import { changePassword, updateProfile } from "@/lib/admin/api";
import { me } from "@/lib/auth/api";
import type { UserProfile } from "@/lib/auth/types";
import { formatDate } from "@/lib/format";
import { adminMessages } from "@/lib/messages/admin";
import { authMessages } from "@/lib/messages/auth";

/**
 * One profile screen for all three roles.
 *
 * Email, username and role are shown but not editable: they decide who you are
 * and what you may do, and the API has no field for changing them from here
 * (CLAUDE.md, ข้อห้าม 7). The commission block only appears for instructors,
 * because it is the only role the number means anything for.
 */
export function ProfileView() {
  const { profile: messages, role: roleLabels } = adminMessages;
  const router = useRouter();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      setUser((await me()).user);
    } catch (caught) {
      setLoadError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Shell>
        <span className="sr-only">{messages.loading}</span>
        <Skeleton className="h-64 rounded-card" />
        <Skeleton className="h-72 rounded-card" />
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <EmptyState
          icon={ServerCrash}
          tone="destructive"
          title={messages.errorTitle}
          body={loadError ?? undefined}
          action={
            <Button variant="outline" onClick={() => void load()}>
              {adminMessages.reports.retry}
            </Button>
          }
        />
      </Shell>
    );
  }

  const commissionPercent = Math.round(Number(user.commissionRate) * 100);

  return (
    <Shell>
      <header>
        <h1 className="text-2xl font-semibold text-primary">{messages.title}</h1>
        <p className="mt-1 text-sm text-muted">{messages.subtitle}</p>
      </header>

      <section className="rounded-card border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">{messages.accountHeading}</h2>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label={messages.emailLabel} value={user.email} />
          <Field label={messages.usernameLabel} value={user.username} />
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-subtle">{messages.roleLabel}</dt>
            <dd>
              <Badge tone={user.role === "ADMIN" ? "primary" : "neutral"}>
                {roleLabels[user.role]}
              </Badge>
            </dd>
          </div>
          <Field label={messages.memberSince} value={formatDate(user.createdAt)} />
        </dl>

        <p className="mt-4 text-xs text-subtle">{messages.fixedNote}</p>
      </section>

      {user.role === "INSTRUCTOR" && (
        <section className="rounded-card border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground">{messages.commissionHeading}</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="tabular rounded-control border border-border bg-background px-4 py-3">
              <p className="text-xs text-subtle">{messages.commissionCurrent}</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{commissionPercent}%</p>
            </div>
            <div className="tabular rounded-control border border-secondary/30 bg-secondary/5 px-4 py-3">
              <p className="text-xs text-subtle">{messages.commissionYours}</p>
              <p className="mt-1 text-xl font-semibold text-secondary">
                {100 - commissionPercent}%
              </p>
            </div>
          </div>

          <p className="mt-4 text-xs text-subtle">{messages.commissionNote}</p>
        </section>
      )}

      <ProfileForm user={user} onSaved={setUser} />
      <PasswordForm onChanged={() => router.push("/login")} />
    </Shell>
  );
}

function ProfileForm({
  user,
  onSaved,
}: {
  user: UserProfile;
  onSaved: (user: UserProfile) => void;
}) {
  const { profile: messages } = adminMessages;

  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio ?? "");
  const [expertise, setExpertise] = useState(user.expertise ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      onSaved(
        await updateProfile({
          displayName: displayName.trim(),
          bio,
          // Only instructors have an expertise line to show under their name.
          ...(user.role === "INSTRUCTOR" ? { expertise } : {}),
        }),
      );
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-4 rounded-card border border-border bg-card p-5"
    >
      <h2 className="text-base font-semibold text-foreground">{messages.profileHeading}</h2>

      {error && <Alert tone="error">{error}</Alert>}
      {saved && (
        <Alert tone="success">
          <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{messages.profileSaved}</span>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="displayName">{messages.displayNameLabel}</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          minLength={2}
          maxLength={100}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bio">{messages.bioLabel}</Label>
        <Textarea
          id="bio"
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          placeholder={messages.bioPlaceholder}
          rows={4}
          maxLength={1000}
        />
      </div>

      {user.role === "INSTRUCTOR" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expertise">{messages.expertiseLabel}</Label>
          <Input
            id="expertise"
            value={expertise}
            onChange={(event) => setExpertise(event.target.value)}
            placeholder={messages.expertisePlaceholder}
            maxLength={200}
          />
          <p className="text-xs text-subtle">{messages.expertiseHelp}</p>
        </div>
      )}

      <Button type="submit" className="self-start" disabled={saving}>
        <Save aria-hidden />
        {saving ? messages.savingProfile : messages.saveProfile}
      </Button>
    </form>
  );
}

function PasswordForm({ onChanged }: { onChanged: () => void }) {
  const { profile: messages } = adminMessages;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Checked here only for the message; the API never sees the second copy.
    if (newPassword !== confirmPassword) {
      setError(messages.passwordMismatch);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await changePassword({ currentPassword, newPassword });
      // Every session was just revoked, this one included.
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-4 rounded-card border border-border bg-card p-5"
    >
      <div>
        <h2 className="text-base font-semibold text-foreground">{messages.securityHeading}</h2>
        <p className="mt-1 text-xs text-subtle">{messages.securityNote}</p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="currentPassword">{messages.currentPasswordLabel}</Label>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newPassword">{messages.newPasswordLabel}</Label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            minLength={8}
            maxLength={72}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmPassword">{messages.confirmPasswordLabel}</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            maxLength={72}
            required
          />
        </div>
      </div>

      <Button type="submit" variant="outline" className="self-start" disabled={saving}>
        <KeyRound aria-hidden />
        {saving ? messages.changingPassword : messages.changePassword}
      </Button>
    </form>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">{children}</div>
  );
}
