"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { courseMessages } from "@/lib/messages/courses";
import { COURSE_SORTS, type CourseFilterState, type CourseSort } from "@/lib/catalog/types";

/**
 * Sort, lifted out of the filter sidebar to sit over the results as the
 * design has it.
 *
 * It applies on change rather than waiting for the sidebar's "ค้นหา" button,
 * because sorting is not a filter: it never changes which courses are in the
 * set, only their order, so there is nothing to review before committing to
 * it. Keeping it in the form would also have meant a half-typed price range
 * got submitted along with a re-sort.
 */
export function CourseSortSelect({ current }: { current: CourseFilterState }) {
  const router = useRouter();
  const { filters } = courseMessages;

  function pushSort(sort: CourseSort): void {
    const params = new URLSearchParams();

    if (current.search.trim()) params.set("search", current.search.trim());
    if (current.categoryId) params.set("categoryId", current.categoryId);
    if (current.freeOnly) {
      params.set("freeOnly", "true");
    } else {
      if (current.minPrice) params.set("minPrice", current.minPrice);
      if (current.maxPrice) params.set("maxPrice", current.maxPrice);
    }
    if (sort !== "latest") params.set("sort", sort);
    // Re-sorting reshuffles the whole set, so page 3 of the old order is
    // meaningless - drop back to the first page rather than carry it over.

    const query = params.toString();
    router.push(query ? `/courses?${query}` : "/courses");
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <label htmlFor="sort-select" className="whitespace-nowrap text-sm text-muted">
        {filters.sort}
      </label>
      <Select
        id="sort-select"
        value={current.sort}
        onChange={(event) => pushSort(event.target.value as CourseSort)}
        className="w-auto"
      >
        {COURSE_SORTS.map((sort) => (
          <option key={sort} value={sort}>
            {filters.sortLabels[sort]}
          </option>
        ))}
      </Select>
    </div>
  );
}
