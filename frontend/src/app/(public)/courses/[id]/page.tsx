import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  ImageOff,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { CourseStatusBadge } from "@/components/shared/CourseStatusBadge";
import { ReportContentButton } from "@/components/shared/ReportContentButton";
import { StickyPanel } from "@/components/shared/StickyPanel";
import { formatBaht, formatCount, formatDuration, isFree } from "@/lib/format";
import { courseMessages } from "@/lib/messages/courses";
import { walletMessages } from "@/lib/messages/wallet";
import { serverFetch } from "@/lib/server-api";
import type { CourseDetail } from "@/lib/catalog/types";
import { CurriculumList } from "./CurriculumList";
import { PurchasePanel } from "./PurchasePanel";

/**
 * One fetch per request, shared by `generateMetadata` and the page below.
 *
 * `cache()` is what makes the sharing safe: the response is deliberately
 * uncacheable between requests (a price or an enrolment must never be stale),
 * so without this the same course would be fetched twice on every view.
 *
 * Known limitation: the visitor gets the right page, but the response carries
 * 200 rather than 404. Next flushes the shell as soon as the render suspends
 * on real I/O — which this fetch is — so by the time `notFound()` runs the
 * status is already on the wire. Moving the call into `generateMetadata` was
 * tried and does not change it. Getting a true 404 would mean checking the
 * course in middleware, i.e. an extra API round trip on every page view, which
 * is not worth it here.
 */
const loadCourse = cache(async (id: string): Promise<CourseDetail> => {
  const { data } = await serverFetch<CourseDetail>(`/courses/${id}`);

  // The API answers 404 for a draft someone else owns exactly as it does for a
  // course that never existed, so both land here as the same page.
  if (!data) {
    notFound();
  }

  return data;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const course = await loadCourse(id);

  return { title: course.title, description: course.description.slice(0, 160) };
}

/**
 * The viewer's wallet balance, or null when nobody is signed in.
 *
 * Read here rather than in the client component so the purchase card renders
 * correctly on first paint. A 401 is the normal answer for a guest on this
 * public page, and `serverFetch` reports it as `data: null` without throwing.
 */
async function loadBalance(): Promise<string | null> {
  const { data } = await serverFetch<{ balance: string }>("/wallet?page=1&limit=1");
  return data?.balance ?? null;
}

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [course, balance] = await Promise.all([loadCourse(id), loadBalance()]);

  const { detail } = courseMessages;
  const free = isFree(course.price);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <Link
        href="/courses"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors duration-150 hover:text-primary"
      >
        <ArrowRight aria-hidden className="size-4 rotate-180" />
        {detail.backToCatalog}
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ---------------------------------------------------------------- */}
        {/* Main column                                                       */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="primary">{course.category.name}</Badge>
              {course.status !== "PUBLISHED" && <CourseStatusBadge status={course.status} />}
              {free && <Badge tone="success">{courseMessages.card.free}</Badge>}
            </div>

            <h1 className="text-2xl font-semibold leading-snug text-foreground lg:text-3xl">
              {course.title}
            </h1>

            <dl className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
              <div className="flex items-center gap-1.5">
                <BookOpen aria-hidden className="size-4" />
                <dd className="tabular">
                  {formatCount(course.lessonCount)} {courseMessages.card.lessonsSuffix}
                </dd>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock aria-hidden className="size-4" />
                <dd className="tabular">{formatDuration(course.totalDurationSec)}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <Users aria-hidden className="size-4" />
                <dd className="tabular">
                  {formatCount(course.enrollmentCount)} {courseMessages.card.studentsSuffix}
                </dd>
              </div>
            </dl>
          </header>

          <div className="relative aspect-video w-full overflow-hidden rounded-card border border-border bg-card">
            {course.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- next/image optimises on the server, which cannot reach a URL signed for the browser
              <img
                src={course.coverUrl}
                alt={course.title}
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-subtle">
                <ImageOff aria-hidden className="size-8" />
                <span className="text-sm">{courseMessages.card.noCover}</span>
              </div>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{detail.aboutHeading}</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
                {course.description}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between gap-3">
              <CardTitle>{detail.curriculumHeading}</CardTitle>
              <span className="tabular text-xs text-muted">
                {detail.totalLength} {formatDuration(course.totalDurationSec)}
              </span>
            </CardHeader>

            {course.lessons.length === 0 ? (
              <CardBody>
                <p className="py-6 text-center text-sm text-subtle">{detail.emptyCurriculum}</p>
              </CardBody>
            ) : (
              <CurriculumList
                courseId={course.id}
                lessons={course.lessons}
                // A wallet exists for every account and for nobody else, so a
                // null balance is the page's only signal that the visitor is
                // not signed in — the same one the purchase panel reads.
                isSignedIn={balance !== null}
              />
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{detail.instructorHeading}</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">{course.instructor.displayName}</p>
              {course.instructor.expertise && (
                <p className="text-sm text-muted">{course.instructor.expertise}</p>
              )}
            </CardBody>
          </Card>

          {balance !== null && !course.isOwner && (
            <div>
              <ReportContentButton targetType="COURSE" targetId={course.id} />
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Sticky purchase card                                              */}
        {/* ---------------------------------------------------------------- */}
        <StickyPanel as="aside" top={96}>
          {/*
            The design tops the purchase panel with a gold rule - the same
            accent the headings carry, turned into the panel's own edge so the
            one card that takes money is marked as different from the cards
            that only describe.
          */}
          <Card className="border-t-4 border-t-secondary">
            <CardBody className="flex flex-col gap-5">
              <div className="text-center">
                {free ? (
                  <p className="text-4xl font-bold text-success">{courseMessages.card.free}</p>
                ) : (
                  <p className="tabular text-4xl font-bold text-secondary">
                    {formatBaht(course.price)}
                  </p>
                )}
                <p className="mt-2 text-xs tracking-wide text-subtle">{detail.priceNote}</p>
              </div>

              {course.isOwner ? (
                <div className="flex flex-col gap-3">
                  <p className="rounded-control border border-border bg-background px-3 py-2.5 text-sm text-muted">
                    {detail.ownerNotice}
                  </p>
                  <Button asChild block size="lg">
                    <Link href={`/instructor/courses/${course.id}`}>{detail.editCourse}</Link>
                  </Button>
                </div>
              ) : course.isEnrolled ? (
                <div className="flex flex-col gap-3">
                  <p className="flex items-center gap-2 rounded-control border border-success/30 bg-success/5 px-3 py-2.5 text-sm text-success">
                    <Check aria-hidden className="size-4" />
                    {detail.alreadyOwned}
                  </p>
                  <Button asChild block size="lg" variant="outline">
                    <Link href="/my-courses">{walletMessages.purchase.goToMyCourses}</Link>
                  </Button>
                </div>
              ) : (
                <PurchasePanel
                  courseId={course.id}
                  price={course.price}
                  isFree={free}
                  balance={balance}
                />
              )}

              <div className="border-t border-border pt-4">
                <p className="mb-2 text-xs font-medium text-foreground">{detail.includes}</p>
                <ul className="flex flex-col gap-2 text-sm text-muted">
                  {[detail.includesLifetime, detail.includesDevices, detail.includesMaterials].map(
                    (item) => (
                      <li key={item} className="flex items-start gap-2">
                        <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-success" />
                        <span>{item}</span>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </CardBody>
          </Card>
        </StickyPanel>
      </div>
    </div>
  );
}
