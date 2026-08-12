import type { Metadata } from "next";
import { learnMessages } from "@/lib/messages/learn";
import { QuizView } from "./QuizView";

export const metadata: Metadata = {
  title: learnMessages.player.takeQuiz,
};

export default async function QuizPage({
  params,
}: {
  params: Promise<{ courseId: string; quizId: string }>;
}) {
  const { courseId, quizId } = await params;
  return <QuizView courseId={courseId} quizId={quizId} />;
}
