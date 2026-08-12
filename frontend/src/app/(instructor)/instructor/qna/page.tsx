import type { Metadata } from "next";
import { qnaMessages } from "@/lib/messages/qna";
import { InstructorQnaInbox } from "./InstructorQnaInbox";

export const metadata: Metadata = {
  title: qnaMessages.inbox.title,
};

export default function InstructorQnaPage() {
  return <InstructorQnaInbox />;
}
