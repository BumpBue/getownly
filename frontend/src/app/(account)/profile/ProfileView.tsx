"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { KeyRound, Save, ServerCrash, Upload } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/lib/api-client";
import { changePassword, updateAvatar, updateProfile } from "@/lib/admin/api";
import { me } from "@/lib/auth/api";
import type { UserProfile } from "@/lib/auth/types";
import { UploadError, uploadFile } from "@/lib/catalog/upload";
import { UPLOAD_ACCEPT } from "@/lib/catalog/types";
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
  const toast = useToast();

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
      <SectionHeading as="h1" title={messages.title} subtitle={messages.subtitle} />

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

      <section className="flex flex-col gap-5 rounded-card border border-border bg-card p-5">
        <AvatarUpload user={user} onSaved={setUser} />
        <div className="border-t border-border" />
        <ProfileForm user={user} onSaved={setUser} />
      </section>

      <PasswordForm
        onChanged={() => {
          toast.success(messages.passwordChangedRedirecting);
          router.push("/login");
        }}
      />
    </Shell>
  );
}

/**
 * Uploads straight to MinIO, the same as a course cover, then hands the key
 * to PATCH /users/me/avatar. Saves the moment a file is picked - there is no
 * separate "save" step for the photo the way there is for the text fields
 * below it, matching how GeneralTab's cover picker already behaves.
 */
function AvatarUpload({
  user,
  onSaved,
}: {
  user: UserProfile;
  onSaved: (user: UserProfile) => void;
}) {
  const { profile: messages } = adminMessages;
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  async function onPicked(file: File): Promise<void> {
    setProgress(0);

    try {
      const uploaded = await uploadFile("avatar", file, setProgress).promise;
      onSaved(await updateAvatar(uploaded.fileKey));
      toast.success(messages.avatarSaved);
    } catch (caught) {
      toast.error(
        caught instanceof UploadError || caught instanceof ApiError
          ? caught.message
          : messages.avatarUploadFailed,
      );
    } finally {
      setProgress(null);
      // Clearing lets the same file be picked again after a failure.
      if (fileInput.current) {
        fileInput.current.value = "";
      }
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar src={user.avatarUrl} name={user.displayName} size="lg" />

      <div className="flex flex-1 flex-col gap-2">
        <p className="text-sm font-medium text-foreground">{messages.avatarHeading}</p>
        <p className="text-xs text-subtle">{messages.avatarHint}</p>

        {progress !== null ? (
          <Progress value={progress} label={messages.avatarUpload} />
        ) : (
          <>
            <input
              ref={fileInput}
              type="file"
              accept={UPLOAD_ACCEPT.avatar.join(",")}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void onPicked(file);
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => fileInput.current?.click()}
            >
              <Upload aria-hidden />
              {user.avatarUrl ? messages.avatarReplace : messages.avatarUpload}
            </Button>
          </>
        )}
      </div>
    </div>
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
  const toast = useToast();

  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio ?? "");
  const [expertise, setExpertise] = useState(user.expertise ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      onSaved(
        await updateProfile({
          displayName: displayName.trim(),
          bio,
          // Only instructors have an expertise line to show under their name.
          ...(user.role === "INSTRUCTOR" ? { expertise } : {}),
        }),
      );
      toast.success(messages.profileSaved);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-foreground">{messages.profileHeading}</h2>

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
  const toast = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Checked here only for the message; the API never sees the second copy.
    if (newPassword !== confirmPassword) {
      toast.error(messages.passwordMismatch);
      return;
    }

    setSaving(true);

    try {
      await changePassword({ currentPassword, newPassword });
      // Every session was just revoked, this one included.
      onChanged();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
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
