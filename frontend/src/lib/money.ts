/**
 * Exact arithmetic on the fixed-point strings the API sends ("1290.00").
 *
 * The browser needs to answer two questions before it can draw the right
 * button: is the wallet enough, and if not, by how much. Both are done in
 * integer satang here, so no amount ever passes through a float — the same rule
 * the backend follows with Decimal (CLAUDE.md, "เรื่องเงิน").
 *
 * These decide what the screen *says*. What is actually charged is decided by
 * the API, which re-reads the price and the balance from the database.
 */

/** "1290.5" -> 129050. Parsed by splitting the string, never by Number(). */
export function toSatang(amount: string): number {
  const trimmed = amount.trim();
  const negative = trimmed.startsWith("-");
  const [baht = "0", fraction = ""] = (negative ? trimmed.slice(1) : trimmed).split(".");

  // Pad "5" to "50" and cut anything past two places, so "1.5" and "1.50" agree.
  const satang = `${fraction}00`.slice(0, 2);
  const total = Number.parseInt(baht || "0", 10) * 100 + Number.parseInt(satang, 10);

  return negative ? -total : total;
}

/** 129050 -> "1290.00", the same shape the API uses. */
export function fromSatang(satang: number): string {
  const negative = satang < 0;
  const absolute = Math.abs(satang);
  return `${negative ? "-" : ""}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

/** True when `balance` covers `price` exactly or with room to spare. */
export function covers(balance: string, price: string): boolean {
  return toSatang(balance) >= toSatang(price);
}

/** How much is still missing, as a fixed-point string. "0.00" when nothing is. */
export function shortfall(balance: string, price: string): string {
  return fromSatang(Math.max(0, toSatang(price) - toSatang(balance)));
}

/**
 * Rounds a shortfall up to the next whole hundred baht.
 *
 * Used to pre-fill the top-up box: nobody transfers 731.50 baht, and a
 * PromptPay QR for a round number is easier to check against a slip.
 */
export function suggestedTopup(amount: string, stepBaht = 100): string {
  const satang = toSatang(amount);
  if (satang <= 0) {
    return "0.00";
  }

  const step = stepBaht * 100;
  return fromSatang(Math.ceil(satang / step) * step);
}
