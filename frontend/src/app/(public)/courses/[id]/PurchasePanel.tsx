"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Check, LogIn, ShoppingCart, Wallet } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { formatBaht } from "@/lib/format";
import { authMessages } from "@/lib/messages/auth";
import { walletMessages } from "@/lib/messages/wallet";
import { covers, shortfall, suggestedTopup } from "@/lib/money";
import { purchaseCourse } from "@/lib/wallet/api";

/**
 * The buy button and everything that decides which one to show.
 *
 * The balance comes in as a prop from the server render, so the button is
 * already the right one on first paint — no flash of "ซื้อคอร์สนี้" for someone
 * who cannot afford it. `null` means nobody is signed in.
 *
 * All of this only decides what the screen *says*. What is actually charged is
 * decided by the API, which locks the wallet and re-reads the price
 * (CLAUDE.md, ข้อห้าม 7).
 */
export function PurchasePanel({
  courseId,
  price,
  isFree,
  balance,
}: {
  courseId: string;
  price: string;
  isFree: boolean;
  balance: string | null;
}) {
  const { purchase } = walletMessages;
  const router = useRouter();

  const [buying, setBuying] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A free course needs no balance at all, so it never asks for a top-up.
  const affordable = isFree || (balance !== null && covers(balance, price));
  const missing = balance === null ? price : shortfall(balance, price);

  const buy = async () => {
    setBuying(true);
    setError(null);

    try {
      await purchaseCourse(courseId);
      setDone(true);
      router.push("/my-courses");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
      setBuying(false);
    }
  };

  if (done) {
    return (
      <Alert tone="success">
        <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>{purchase.success}</span>
      </Alert>
    );
  }

  // Not signed in: the API would answer 401, so the button says so up front.
  if (balance === null) {
    return (
      <Button asChild block size="lg">
        <Link href={`/login?next=${encodeURIComponent(`/courses/${courseId}`)}`}>
          <LogIn aria-hidden />
          {purchase.signInToBuy}
        </Link>
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="error">{error}</Alert>}

      {affordable ? (
        <>
          <Button type="button" block size="lg" disabled={buying} onClick={() => void buy()}>
            <ShoppingCart aria-hidden />
            {buying ? purchase.buying : isFree ? purchase.enrollFree : purchase.buy}
          </Button>

          {!isFree && (
            <p className="tabular flex items-center justify-center gap-1.5 text-xs text-muted">
              <Wallet aria-hidden className="size-3.5" />
              {purchase.balancePrefix} {formatBaht(balance)}
            </p>
          )}
        </>
      ) : (
        <>
          {/* `pending` is the warning token — the palette has no orange
              (CLAUDE.md, หัวข้อ 4), and a shortfall is a warning, not an error. */}
          <p className="tabular flex items-start gap-2 rounded-control border border-pending/30 bg-pending/5 px-3 py-2.5 text-sm text-pending">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              {purchase.shortfallPrefix} {formatBaht(missing)}
            </span>
          </p>

          <Button asChild block size="lg">
            {/* Pre-filled with the shortfall rounded up to a round number,
                which is what people actually transfer. */}
            <Link href={`/wallet/topup?amount=${suggestedTopup(missing)}`}>
              <Wallet aria-hidden />
              {purchase.topupToBuy}
            </Link>
          </Button>

          <p className="tabular text-center text-xs text-muted">
            {purchase.balancePrefix} {formatBaht(balance)}
          </p>
        </>
      )}
    </div>
  );
}
