import type { Metadata } from "next";
import { SearchX, ServerCrash } from "lucide-react";
import { CourseCard } from "@/components/shared/CourseCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatCount } from "@/lib/format";
import { courseMessages } from "@/lib/messages/courses";
import { serverFetch } from "@/lib/server-api";
import {
  COURSE_SORTS,
  type Category,
  type CourseFilterState,
  type CourseSort,
  type PaginatedCourses,
} from "@/lib/catalog/types";
import { CourseFilters } from "./CourseFilters";
import { CoursePagination } from "./CoursePagination";

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

  const [coursesResult, categoriesResult] = await Promise.all([
    serverFetch<PaginatedCourses>(`/courses?${buildQuery(filters)}`),
    serverFetch<Category[]>("/categories"),
  ]);

  const { catalog } = courseMessages;
  const courses = coursesResult.data;
  const categories = categoriesResult.data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-primary lg:text-3xl">{catalog.title}</h1>
        <p className="mt-2 text-sm text-muted">{catalog.subtitle}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <CourseFilters categories={categories} current={filters} />
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
              <p className="mb-4 text-sm text-muted">
                {catalog.resultsPrefix}{" "}
                <span className="tabular font-medium text-foreground">
                  {formatCount(courses.total)}
                </span>{" "}
                {catalog.resultsSuffix}
              </p>

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
