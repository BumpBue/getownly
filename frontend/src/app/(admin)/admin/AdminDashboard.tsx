"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookCheck,
  CheckCircle2,
  Coins,
  Receipt,
  UserPlus,
  UserX,
  Wallet,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/shared/StatTile";
import { ApiError } from "@/lib/api-client";
import { getAdminOverview, listPendingCourses, listUsers } from "@/lib/admin/api";
import type { AdminOverview } from "@/lib/admin/types";
import { formatBaht, formatCount } from "@/lib/format";
import { adminMessages } from "@/lib/messages/admin";
import { authMessages } from "@/lib/messages/auth";
import { listTopupsForAdmin } from "@/lib/wallet/api";

interface Queues {
  topups: number;
  courses: number;
  suspended: number;
}

/**
 * Where an admin lands: what is waiting for them, then how the platform did.
 *
 * The queue counts come from the three list endpoints asked for one row each,
 * because each already reports its own total — a fourth "counts" endpoint
 * would be a second place for the same number to be computed.
 */
export function AdminDashboard() {
  const { dashboard, reports } = adminMessages;

  const [queues, setQueues] = useState<Queues | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [topups, courses, users, stats] = await Promise.all([
        listTopupsForAdmin({ status: "PENDING", limit: 1 }),
        listPendingCourses(1),
        listUsers({ status: "SUSPENDED", page: 1 }),
        getAdminOverview({}),
      ]);

      setQueues({
        topups: topups.pendingTotal,
        courses: courses.total,
        suspended: users.counts.suspended,
      });
      setOverview(stats);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const allClear =
    queues !== null && queues.topups === 0 && queues.courses === 0 && queues.suspended === 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold text-primary">{dashboard.title}</h1>
        <p className="mt-1 text-sm text-muted">{dashboard.subtitle}</p>
      </header>

      {error && <Alert tone="error">{error}</Alert>}

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">{dashboard.queueHeading}</h2>
          {allClear && (
            <span className="flex items-center gap-1.5 text-sm text-success">
              <CheckCircle2 aria-hidden className="size-4" />
              {dashboard.allClear}
            </span>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QueueTile
            icon={Receipt}
            label={dashboard.pendingTopups}
            count={queues?.topups ?? null}
            href="/admin/topups"
            loading={loading}
          />
          <QueueTile
            icon={BookCheck}
            label={dashboard.pendingCourses}
            count={queues?.courses ?? null}
            href="/admin/courses"
            loading={loading}
          />
          <QueueTile
            icon={UserX}
            label={dashboard.suspendedUsers}
            count={queues?.suspended ?? null}
            href="/admin/users?status=SUSPENDED"
            loading={loading}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">{dashboard.statsHeading}</h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/reports">
              <BarChart3 aria-hidden />
              {dashboard.viewReports}
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            icon={Wallet}
            label={reports.grossSales}
            value={formatBaht(overview?.grossSales.value ?? "0")}
            changePercent={overview?.grossSales.changePercent}
            loading={loading}
          />
          <StatTile
            icon={Coins}
            label={reports.platformRevenue}
            value={formatBaht(overview?.platformRevenue.value ?? "0")}
            changePercent={overview?.platformRevenue.changePercent}
            loading={loading}
          />
          <StatTile
            icon={Coins}
            label={reports.instructorPayable}
            value={formatBaht(overview?.instructorPayable.value ?? "0")}
            changePercent={overview?.instructorPayable.changePercent}
            loading={loading}
          />
          <StatTile
            icon={UserPlus}
            label={reports.newUsers}
            value={formatCount(Number(overview?.newUsers.value ?? 0))}
            suffix={reports.peopleSuffix}
            changePercent={overview?.newUsers.changePercent}
            loading={loading}
          />
        </div>
      </section>
    </div>
  );
}

function QueueTile({
  icon: Icon,
  label,
  count,
  href,
  loading,
}: {
  icon: typeof Receipt;
  label: string;
  count: number | null;
  href: string;
  loading: boolean;
}) {
  const { dashboard } = adminMessages;

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-card px-5 py-4">
      <div className="flex items-center gap-2 text-xs text-muted">
        <Icon aria-hidden className="size-3.5 text-pending" />
        {label}
      </div>

      {loading || count === null ? (
        <Skeleton className="h-9 w-20" />
      ) : (
        <p className="tabular text-3xl font-semibold text-foreground">
          {formatCount(count)}
          <span className="ml-1 text-sm font-normal text-muted">{dashboard.itemsSuffix}</span>
        </p>
      )}

      <Button asChild variant="outline" size="sm" className="mt-auto w-fit">
        <Link href={href}>
          {dashboard.openQueue}
          <ArrowRight aria-hidden />
        </Link>
      </Button>
    </div>
  );
}
