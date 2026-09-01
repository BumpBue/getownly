"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderTree, Pencil, Plus, ServerCrash, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/lib/api-client";
import {
  createCategory,
  deleteCategory,
  listAdminCategories,
  updateCategory,
} from "@/lib/admin/api";
import type { AdminCategory } from "@/lib/admin/types";
import { formatCount } from "@/lib/format";
import { adminMessages } from "@/lib/messages/admin";
import { authMessages } from "@/lib/messages/auth";

/** Add, rename and remove the categories courses are filed under. */
export function CategoriesManager() {
  const { categories: messages } = adminMessages;
  const toast = useToast();

  const [items, setItems] = useState<AdminCategory[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** The row being edited, or "new" while the add form is open. */
  const [editing, setEditing] = useState<AdminCategory | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setItems(await listAdminCategories());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (category: AdminCategory) => {
    if (!window.confirm(`${messages.removeConfirm}: ${category.name}`)) {
      return;
    }

    setBusyId(category.id);
    setError(null);

    try {
      await deleteCategory(category.id);
      toast.success(messages.removeSuccess);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <SectionHeading
        as="h1"
        title={messages.title}
        subtitle={messages.subtitle}
        action={
          editing === null && (
            <Button type="button" onClick={() => setEditing("new")}>
              <Plus aria-hidden />
              {messages.add}
            </Button>
          )
        }
      />

      {error && <Alert tone="error">{error}</Alert>}

      {editing !== null && (
        <CategoryForm
          category={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            toast.success(editing === "new" ? messages.savedNew : messages.savedEdit);
            setEditing(null);
            void load();
          }}
        />
      )}

      {loading && items === null ? (
        <div className="flex flex-col gap-3">
          <span className="sr-only">{messages.loading}</span>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-14 rounded-card" />
          ))}
        </div>
      ) : error && items === null ? (
        <EmptyState
          icon={ServerCrash}
          tone="destructive"
          title={messages.errorTitle}
          body={error}
          action={
            <Button variant="outline" onClick={() => void load()}>
              {adminMessages.reports.retry}
            </Button>
          }
        />
      ) : items && items.length > 0 ? (
        <div className="overflow-hidden rounded-card border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="border-b border-border text-left text-xs text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">{messages.columnName}</th>
                  <th className="px-5 py-3 font-medium">{messages.columnSlug}</th>
                  <th className="px-5 py-3 font-medium">{messages.columnCourses}</th>
                  <th className="px-5 py-3 text-right font-medium">{messages.columnActions}</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {items.map((category) => (
                  <tr key={category.id} className="transition-colors duration-150 hover:bg-background">
                    <td className="px-5 py-3 font-medium text-foreground">{category.name}</td>
                    <td className="px-5 py-3 text-muted">{category.slug}</td>
                    <td className="tabular px-5 py-3 text-xs text-muted">
                      {formatCount(category.courseCount)} {messages.publishedSuffix} ·{" "}
                      {formatCount(category.totalCourseCount)} {messages.totalSuffix}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busyId === category.id}
                          onClick={() => setEditing(category)}
                        >
                          <Pencil aria-hidden />
                          {messages.edit}
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busyId === category.id || category.totalCourseCount > 0}
                          title={category.totalCourseCount > 0 ? messages.inUse : undefined}
                          onClick={() => void remove(category)}
                          className="text-destructive hover:bg-destructive/5 hover:text-destructive"
                        >
                          <Trash2 aria-hidden />
                          {messages.remove}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={FolderTree}
          title={messages.emptyTitle}
          body={messages.emptyBody}
          action={
            <Button type="button" onClick={() => setEditing("new")}>
              {messages.add}
            </Button>
          }
        />
      )}
    </div>
  );
}

function CategoryForm({
  category,
  onSaved,
  onCancel,
}: {
  category: AdminCategory | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { categories: messages } = adminMessages;

  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (category) {
        await updateCategory(category.id, { name: name.trim(), slug: slug.trim() });
      } else {
        // An empty slug is omitted rather than sent blank, so the API knows to
        // generate one instead of rejecting it as malformed.
        await createCategory({
          name: name.trim(),
          ...(slug.trim() ? { slug: slug.trim() } : {}),
        });
      }
      onSaved();
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
      <h2 className="text-base font-semibold text-foreground">
        {category ? messages.editTitle : messages.addTitle}
      </h2>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category-name">{messages.nameLabel}</Label>
          <Input
            id="category-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={messages.namePlaceholder}
            minLength={2}
            maxLength={80}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category-slug">{messages.slugLabel}</Label>
          <Input
            id="category-slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder={messages.slugPlaceholder}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={80}
          />
          <p className="text-xs text-subtle">{messages.slugHelp}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? messages.saving : messages.save}
        </Button>
        <Button type="button" variant="ghost" disabled={saving} onClick={onCancel}>
          {messages.cancel}
        </Button>
      </div>
    </form>
  );
}
