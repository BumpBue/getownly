import type { Metadata } from "next";
import { learnMessages } from "@/lib/messages/learn";
import { QuizResultView } from "./QuizResultView";

export const metadata: Metadata = {
  title: learnMessages.result.title,
};

export default async function QuizResultPage({
  params,
}: {
  params: Promise<{ courseId: string; quizId: string }>;
}) {
  const { courseId, quizId } = await params;
  return <QuizResultView courseId={courseId} quizId={quizId} />;
}
