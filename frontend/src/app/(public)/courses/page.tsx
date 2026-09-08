import type { Metadata } from "next";
import { SearchX, ServerCrash } from "lucide-react";
import { CourseCard } from "@/components/shared/CourseCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { formatCount } from "@/lib/format";
import { courseMessages } from "@/lib/messages/courses";
import { serverFetch } from "@/lib/server-api";
import {
  COURSE_SORTS,
  type CatalogInstructor,
  type Category,
  type CourseFilterState,
  type CourseSort,
  type PaginatedCourses,
} from "@/lib/catalog/types";
import { CourseFilters } from "./CourseFilters";
import { CoursePagination } from "./CoursePagination";
import { CourseSortSelect } from "./CourseSortSelect";

export const metadata: Metadata = {
  title: courseMessages.catalog.title,
  description: courseMessages.catalog.subtitle,
};

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The catalog. Rendered on the server so the grid is in the first HTML
 * response; only the filter form is interactive, and its state lives in the
 * URL rather than in React (see CourseFilters).
 */
export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters = readFilters(params);

  const [coursesResult, categoriesResult, instructorsResult] = await Promise.all([
    serverFetch<PaginatedCourses>(`/courses?${buildQuery(filters)}`),
    serverFetch<Category[]>("/categories"),
    // Only instructors with something published, so a name in the dropdown
    // always selects at least one course (ทก.01 B3).
    serverFetch<CatalogInstructor[]>("/courses/instructors"),
  ]);

  const { catalog } = courseMessages;
  const courses = coursesResult.data;
  const categories = categoriesResult.data ?? [];
  const instructors = instructorsResult.data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <SectionHeading as="h1" title={catalog.title} subtitle={catalog.subtitle} className="mb-8" />

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <CourseFilters categories={categories} instructors={instructors} current={filters} />
        </aside>

        <section>
          {courses === null ? (
            <EmptyState
              icon={ServerCrash}
              tone="destructive"
              title={catalog.errorTitle}
              body={coursesResult.message ?? catalog.errorBody}
            />
          ) : courses.items.length === 0 ? (
            <EmptyState icon={SearchX} title={catalog.emptyTitle} body={catalog.emptyBody} />
          ) : (
            <>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <p className="text-sm text-muted">
                  {catalog.resultsPrefix}{" "}
                  <span className="tabular font-medium text-foreground">
                    {formatCount(courses.total)}
                  </span>{" "}
                  {catalog.resultsSuffix}
                </p>

                <CourseSortSelect current={filters} />
              </div>

              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {courses.items.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>

              <CoursePagination
                page={courses.page}
                totalPages={courses.totalPages}
                buildHref={(page) => `/courses?${buildQuery({ ...filters, page })}`}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Reads the URL into filter state.
 *
 * Anything unparseable falls back to a default rather than erroring: a
 * hand-edited query string should still render a page.
 */
function readFilters(params: SearchParams): CourseFilterState {
  const sort = single(params.sort);
  const page = Number(single(params.page));

  return {
    search: single(params.search) ?? "",
    categoryId: single(params.categoryId) ?? "",
    instructorId: single(params.instructorId) ?? "",
    minPrice: single(params.minPrice) ?? "",
    maxPrice: single(params.maxPrice) ?? "",
    freeOnly: single(params.freeOnly) === "true",
    sort: isSort(sort) ? sort : "latest",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

function buildQuery(filters: CourseFilterState): string {
  const params = new URLSearchParams();

  if (filters.search) params.set("search", filters.search);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.instructorId) params.set("instructorId", filters.instructorId);
  if (filters.freeOnly) {
    params.set("freeOnly", "true");
  } else {
    if (filters.minPrice) params.set("minPrice", filters.minPrice);
    if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  }
  if (filters.sort !== "latest") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));

  return params.toString();
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isSort(value: string | undefined): value is CourseSort {
  return value !== undefined && (COURSE_SORTS as readonly string[]).includes(value);
}
