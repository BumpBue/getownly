import type { Metadata } from "next";
import { adminMessages } from "@/lib/messages/admin";
import { CategoriesManager } from "./CategoriesManager";

export const metadata: Metadata = {
  title: adminMessages.categories.title,
};

export default function AdminCategoriesPage() {
  return <CategoriesManager />;
}
