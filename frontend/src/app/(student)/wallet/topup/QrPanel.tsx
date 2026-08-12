"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, Download } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatBaht } from "@/lib/format";
import { walletMessages } from "@/lib/messages/wallet";
import type { TopupQuote } from "@/lib/wallet/types";

/**
 * The QR itself, plus everything a Thai payer expects around it: the payee, the
 * exact amount, a copyable PromptPay number, and a download button — saving the
 * image and scanning it from the gallery is how most banking apps get used.
 */
export function QrPanel({ quote }: { quote: TopupQuote }) {
  const { topup } = walletMessages;
  const [copied, setCopied] = useState(false);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(quote.promptpayId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the number is on screen to read.
    }
  };

  const download = () => {
    const link = document.createElement("a");
    link.href = quote.qrDataUrl;
    link.download = `${topup.downloadFileName}-${quote.amount}.png`;
    link.click();
  };

  return (
    <div className="flex flex-col gap-4">
      {quote.isDemoMode && (
        <Alert tone="pending">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{topup.demoNotice}</span>
        </Alert>
      )}

      <div className="flex flex-col items-center gap-4 rounded-card border border-border bg-background p-5">
        {/* A base64 data URI: nothing for next/image to optimise or host. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={quote.qrDataUrl}
          alt={topup.qrAlt}
          width={256}
          height={256}
          className="size-64 rounded-control border border-border bg-card p-2"
        />

        <dl className="w-full max-w-sm divide-y divide-border text-sm">
          <Row label={topup.amountLabel}>
            <span className="tabular text-lg font-bold text-secondary">
              {formatBaht(quote.amount)}
            </span>
          </Row>
          <Row label={topup.payeeLabel}>
            <span className="font-medium text-foreground">{quote.promptpayName}</span>
          </Row>
          <Row label={topup.promptpayLabel}>
            <span className="tabular font-medium text-foreground">{quote.promptpayId}</span>
          </Row>
        </dl>

        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void copyId()}>
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? topup.copied : topup.copyId}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={download}>
            <Download aria-hidden />
            {topup.downloadQr}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
