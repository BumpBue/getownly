"use client";

import { useCallback, useEffect, useState } from "react";
import { Percent, Search, ServerCrash, UserCheck, Users, UserX, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pager } from "@/components/shared/Pager";
import { StatTile } from "@/components/shared/StatTile";
import { ApiError } from "@/lib/api-client";
import { listUsers, setUserStatus } from "@/lib/admin/api";
import {
  USER_ROLES,
  USER_STATUSES,
  type AdminUser,
  type PaginatedAdminUsers,
  type UserRole,
  type UserStatus,
} from "@/lib/admin/types";
import { formatCount, formatDate } from "@/lib/format";
import { adminMessages } from "@/lib/messages/admin";
import { authMessages } from "@/lib/messages/auth";
import { CommissionDialog } from "./CommissionDialog";

/** The user directory, with the two actions an admin can take on a row. */
export function UsersTable({ initialStatus }: { initialStatus?: UserStatus }) {
  const { users: messages, role: roleLabels, status: statusLabels } = adminMessages;

  const [data, setData] = useState<PaginatedAdminUsers | null>(null);
  const [role, setRole] = useState<UserRole | "">("");
  const [status, setStatus] = useState<UserStatus | "">(initialStatus ?? "");
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setData(
        await listUsers({
          ...(role ? { role } : {}),
          ...(status ? { status } : {}),
          ...(search ? { search } : {}),
          page,
        }),
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setLoading(false);
    }
  }, [role, status, search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Applies one changed row in place, so the table does not jump on save. */
  const replaceRow = (updated: AdminUser) => {
    setData((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) => (item.id === updated.id ? updated : item)),
          }
        : current,
    );
  };

  const toggleStatus = async (user: AdminUser) => {
    const next: UserStatus = user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    if (next === "SUSPENDED" && !window.confirm(messages.suspendConfirm)) {
      return;
    }

    setBusyId(user.id);
    setError(null);

    try {
      replaceRow(await setUserStatus(user.id, next));
      // The counts above the table are platform-wide, so they moved too.
      void load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setBusyId(null);
    }
  };

  const isFiltered = role !== "" || status !== "" || search !== "";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-primary">{messages.title}</h1>
        <p className="mt-1 text-sm text-muted">{messages.subtitle}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={Users}
          label={messages.countTotal}
          value={formatCount(data?.counts.total ?? 0)}
          loading={loading && data === null}
        />
        <StatTile
          icon={Users}
          label={messages.countStudents}
          value={formatCount(data?.counts.students ?? 0)}
          loading={loading && data === null}
        />
        <StatTile
          icon={Users}
          label={messages.countInstructors}
          value={formatCount(data?.counts.instructors ?? 0)}
          loading={loading && data === null}
        />
        <StatTile
          icon={UserX}
          label={messages.countSuspended}
          value={formatCount(data?.counts.suspended ?? 0)}
          loading={loading && data === null}
        />
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(searchDraft.trim());
          setPage(1);
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <Select
          aria-label={messages.allRoles}
          value={role}
          onChange={(event) => {
            setRole(event.target.value as UserRole | "");
            setPage(1);
          }}
          className="w-40"
        >
          <option value="">{messages.allRoles}</option>
          {USER_ROLES.map((value) => (
            <option key={value} value={value}>
              {roleLabels[value]}
            </option>
          ))}
        </Select>

        <Select
          aria-label={messages.allStatuses}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as UserStatus | "");
            setPage(1);
          }}
          className="w-40"
        >
          <option value="">{messages.allStatuses}</option>
          {USER_STATUSES.map((value) => (
            <option key={value} value={value}>
              {statusLabels[value]}
            </option>
          ))}
        </Select>

        <Input
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          placeholder={messages.searchPlaceholder}
          aria-label={messages.searchPlaceholder}
          className="w-64"
        />

        <Button type="submit" variant="outline">
          <Search aria-hidden />
        </Button>

        {isFiltered && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setRole("");
              setStatus("");
              setSearch("");
              setSearchDraft("");
              setPage(1);
            }}
          >
            <X aria-hidden />
          </Button>
        )}
      </form>

      {loading && data === null ? (
        <div className="flex flex-col gap-3">
          <span className="sr-only">{messages.loading}</span>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-16 rounded-card" />
          ))}
        </div>
      ) : error && data === null ? (
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
      ) : data && data.items.length > 0 ? (
        <div className="overflow-hidden rounded-card border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="border-b border-border text-left text-xs text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">{messages.columnUser}</th>
                  <th className="px-5 py-3 font-medium">{messages.columnRole}</th>
                  <th className="px-5 py-3 font-medium">{messages.columnStatus}</th>
                  <th className="px-5 py-3 font-medium">{messages.columnCommission}</th>
                  <th className="px-5 py-3 font-medium">{messages.columnActivity}</th>
                  <th className="px-5 py-3 text-right font-medium">{messages.columnActions}</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {data.items.map((user) => (
                  <tr key={user.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-foreground">{user.displayName}</p>
                      <p className="text-xs text-subtle">{user.email}</p>
                      <p className="tabular text-xs text-subtle">
                        {formatDate(user.createdAt)}
                      </p>
                    </td>

                    <td className="px-5 py-3">
                      <Badge tone={user.role === "ADMIN" ? "primary" : "neutral"}>
                        {roleLabels[user.role]}
                      </Badge>
                    </td>

                    <td className="px-5 py-3">
                      <Badge tone={user.status === "ACTIVE" ? "success" : "destructive"}>
                        {statusLabels[user.status]}
                      </Badge>
                    </td>

                    <td className="tabular px-5 py-3">
                      {user.role === "INSTRUCTOR" ? (
                        `${Math.round(Number(user.commissionRate) * 100)}%`
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>

                    <td className="tabular px-5 py-3 text-xs text-muted">
                      {user.role === "INSTRUCTOR"
                        ? `${formatCount(user.courseCount)} ${messages.coursesSuffix}`
                        : `${formatCount(user.enrollmentCount)} ${messages.enrollmentsSuffix}`}
                    </td>

                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        {user.role === "INSTRUCTOR" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={busyId === user.id}
                            onClick={() => setEditing(user)}
                          >
                            <Percent aria-hidden />
                            {messages.editCommission}
                          </Button>
                        )}

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busyId === user.id}
                          onClick={() => void toggleStatus(user)}
                          className={
                            user.status === "ACTIVE"
                              ? "text-destructive hover:bg-destructive/5 hover:text-destructive"
                              : "text-success hover:bg-success/5 hover:text-success"
                          }
                        >
                          {user.status === "ACTIVE" ? (
                            <UserX aria-hidden />
                          ) : (
                            <UserCheck aria-hidden />
                          )}
                          {user.status === "ACTIVE" ? messages.suspend : messages.restore}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pager page={data.page} totalPages={data.totalPages} disabled={loading} onChange={setPage} />
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title={isFiltered ? messages.emptyTitle : messages.countTotal}
          body={isFiltered ? messages.emptyBody : undefined}
        />
      )}

      {editing && (
        <CommissionDialog
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            replaceRow(updated);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
