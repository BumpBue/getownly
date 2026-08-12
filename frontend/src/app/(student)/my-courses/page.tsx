import type { Metadata } from "next";
import { walletMessages } from "@/lib/messages/wallet";
import { MyCoursesView } from "./MyCoursesView";

export const metadata: Metadata = {
  title: walletMessages.myCourses.title,
  description: walletMessages.myCourses.subtitle,
};

export default function MyCoursesPage() {
  return <MyCoursesView />;
}
