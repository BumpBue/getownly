import type { Metadata } from "next";
import { authMessages } from "@/lib/messages/auth";
import { HomeView } from "./HomeView";

export const metadata: Metadata = {
  title: authMessages.brand.name,
};

export default function HomePage() {
  return <HomeView />;
}
