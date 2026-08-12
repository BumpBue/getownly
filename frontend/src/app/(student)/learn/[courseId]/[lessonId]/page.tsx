import type { Metadata } from "next";
import { learnMessages } from "@/lib/messages/learn";
import { LessonView } from "./LessonView";

export const metadata: Metadata = {
  title: learnMessages.sidebar.heading,
};

export default async function LessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  return <LessonView courseId={courseId} lessonId={lessonId} />;
}
