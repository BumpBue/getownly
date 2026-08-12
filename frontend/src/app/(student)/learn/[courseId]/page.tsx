import type { Metadata } from "next";
import { learnMessages } from "@/lib/messages/learn";
import { ResumeRedirect } from "./ResumeRedirect";

export const metadata: Metadata = {
  title: learnMessages.room.loading,
};

/**
 * `/learn/<course>` is not a screen, it is a doorway: it works out which lesson
 * this student should be on and sends them there.
 */
export default async function LearnCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  return <ResumeRedirect courseId={courseId} />;
}
