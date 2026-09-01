import type { Metadata } from "next";
import { CategorySection } from "./CategorySection";
import { FeaturedSection } from "./FeaturedSection";
import { HeroSection } from "./HeroSection";
import { InstructorSection } from "./InstructorSection";
import { WhySection } from "./WhySection";
import { authMessages } from "@/lib/messages/auth";
import { serverFetch } from "@/lib/server-api";
import type { Category, PaginatedCourses } from "@/lib/catalog/types";
import type { PublicStats } from "@/lib/stats/types";

export const metadata: Metadata = {
  title: authMessages.brand.name,
  description: authMessages.brand.pitchBody,
};

const FEATURED_LIMIT = 6;
const TOP_CATEGORY_COUNT = 4;

/**
 * The guest landing page. A signed-in visitor never reaches this - middleware
 * sends them to /courses before this component ever runs - so everything
 * here is written for someone who has not signed up yet.
 */
export default async function LandingPage() {
  const [statsResult, categoriesResult, featuredResult] = await Promise.all([
    serverFetch<PublicStats>("/stats/public"),
    serverFetch<Category[]>("/categories"),
    serverFetch<PaginatedCourses>(`/courses?sort=popular&limit=${FEATURED_LIMIT}`),
  ]);

  const topCategories = [...(categoriesResult.data ?? [])]
    .sort((a, b) => b.courseCount - a.courseCount)
    .slice(0, TOP_CATEGORY_COUNT);
  const featuredCourses = featuredResult.data?.items ?? [];

  return (
    <div>
      <HeroSection stats={statsResult.data} />
      {topCategories.length > 0 && <CategorySection categories={topCategories} />}
      <FeaturedSection courses={featuredCourses} />
      <WhySection />
      <InstructorSection />
    </div>
  );
}
