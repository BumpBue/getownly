import type { Metadata } from "next";
import { qnaMessages } from "@/lib/messages/qna";
import { QnaBoard } from "./QnaBoard";

export const metadata: Metadata = {
  title: qnaMessages.board.title,
};

export default async function CourseQnaPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { courseId } = await params;
  // Set when the board is opened from a lesson, so a question asked there
  // arrives tied to the lesson the student was watching.
  const { lesson } = await searchParams;

  return <QnaBoard courseId={courseId} fromLessonId={lesson ?? null} />;
}
