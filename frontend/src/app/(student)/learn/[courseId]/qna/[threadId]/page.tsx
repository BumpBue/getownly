import type { Metadata } from "next";
import { qnaMessages } from "@/lib/messages/qna";
import { QnaThreadView } from "./QnaThreadView";

export const metadata: Metadata = {
  title: qnaMessages.board.title,
};

export default async function QnaThreadPage({
  params,
}: {
  params: Promise<{ courseId: string; threadId: string }>;
}) {
  const { courseId, threadId } = await params;
  return <QnaThreadView courseId={courseId} threadId={threadId} />;
}
