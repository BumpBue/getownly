import type { Metadata } from "next";
import { walletMessages } from "@/lib/messages/wallet";
import { TopupForm } from "./TopupForm";

export const metadata: Metadata = {
  title: walletMessages.topup.title,
  description: walletMessages.topup.subtitle,
};

/** Same shape the API accepts, so a hand-edited URL cannot pre-fill nonsense. */
const AMOUNT_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;

/**
 * `?amount=` is read here rather than with `useSearchParams` inside the form.
 * The hook would opt the whole subtree out of server rendering (CLAUDE.md,
 * หัวข้อ 8); a prop from the server page costs nothing.
 *
 * It arrives when a course page sends someone here because their wallet was
 * short — the box is pre-filled with the amount that would cover it.
 */
export default async function TopupPage({
  searchParams,
}: {
  searchParams: Promise<{ amount?: string | string[] }>;
}) {
  const { amount } = await searchParams;
  const requested = typeof amount === "string" && AMOUNT_PATTERN.test(amount) ? amount : null;

  return <TopupForm initialAmount={requested} />;
}
