"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { courseMessages } from "@/lib/messages/courses";
import { COURSE_SORTS, type Category, type CourseFilterState } from "@/lib/catalog/types";

/**
 * The filter sidebar.
 *
 * All state lives in the URL, so the grid stays a Server Component, the back
 * button works, and a filtered search is a link someone can share. This
 * component only edits a draft and pushes it.
 */
export function CourseFilters({
  categories,
  current,
}: {
  categories: Category[];
  current: CourseFilterState;
}) {
  const router = useRouter();
  const { filters } = courseMessages;

  const [draft, setDraft] = useState<CourseFilterState>(current);

  function pushFilters(next: CourseFilterState): void {
    const params = new URLSearchParams();

    if (next.search.trim()) params.set("search", next.search.trim());
    if (next.categoryId) params.set("categoryId", next.categoryId);
    if (next.freeOnly) {
      params.set("freeOnly", "true");
    } else {
      if (next.minPrice) params.set("minPrice", next.minPrice);
      if (next.maxPrice) params.set("maxPrice", next.maxPrice);
    }
    if (next.sort !== "latest") params.set("sort", next.sort);
    // Any change to the filters invalidates the page number.

    const query = params.toString();
    router.push(query ? `/courses?${query}` : "/courses");
  }

  const empty: CourseFilterState = {
    search: "",
    categoryId: "",
    minPrice: "",
    maxPrice: "",
    freeOnly: false,
    sort: "latest",
    page: 1,
  };

  const hasFilters =
    Boolean(current.search || current.categoryId || current.minPrice || current.maxPrice) ||
    current.freeOnly ||
    current.sort !== "latest";

  return (
    <form
      className="flex flex-col gap-6 rounded-card border border-border bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault();
        pushFilters(draft);
      }}
    >
      <h2 className="text-sm font-semibold text-foreground">{filters.heading}</h2>

      <div className="flex flex-col gap-2">
        <Label htmlFor="filter-search">{filters.search}</Label>
        <div className="relative">
          <Search aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input
            id="filter-search"
            value={draft.search}
            onChange={(event) => setDraft({ ...draft, search: event.target.value })}
            placeholder={filters.searchPlaceholder}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="filter-category">{filters.category}</Label>
        <Select
          id="filter-category"
          value={draft.categoryId}
          onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}
        >
          <option value="">{filters.allCategories}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name} ({category.courseCount})
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="filter-min-price">{filters.price}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="filter-min-price"
            inputMode="numeric"
            value={draft.minPrice}
            disabled={draft.freeOnly}
            onChange={(event) => setDraft({ ...draft, minPrice: sanitisePrice(event.target.value) })}
            placeholder={filters.minPrice}
            className="tabular"
          />
          <span className="text-subtle">–</span>
          <Input
            inputMode="numeric"
            value={draft.maxPrice}
            disabled={draft.freeOnly}
            onChange={(event) => setDraft({ ...draft, maxPrice: sanitisePrice(event.target.value) })}
            placeholder={filters.maxPrice}
            aria-label={filters.maxPrice}
            className="tabular"
          />
        </div>

        <label className="mt-1 flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={draft.freeOnly}
            onChange={(event) => setDraft({ ...draft, freeOnly: event.target.checked })}
            className="size-4 rounded-sm border-border accent-primary"
          />
          {filters.freeOnly}
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="filter-sort">{filters.sort}</Label>
        <Select
          id="filter-sort"
          value={draft.sort}
          onChange={(event) =>
            setDraft({ ...draft, sort: event.target.value as CourseFilterState["sort"] })
          }
        >
          {COURSE_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {filters.sortLabels[sort]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Button type="submit" block>
          {filters.apply}
        </Button>
        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            block
            onClick={() => {
              setDraft(empty);
              pushFilters(empty);
            }}
          >
            <X aria-hidden />
            {filters.clear}
          </Button>
        )}
      </div>
    </form>
  );
}

/** Keeps the price boxes to digits and at most two decimals, as the API expects. */
function sanitisePrice(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  return rest.length > 0 ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
}
