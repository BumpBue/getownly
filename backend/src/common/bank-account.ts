/**
 * The one place a bank account number is hidden.
 *
 * A payout is transferred by hand, so the platform has to store the number in
 * full. Everything that shows it back — an instructor's own list of requests,
 * the admin queue listing — shows this instead. Exactly two responses in the
 * API carry the real thing: the owner's own edit form, and the admin review
 * screen where somebody is about to type it into a banking app.
 *
 * Written here rather than inside a service so that a second version of it,
 * with a different idea of how many digits are safe to show, cannot appear.
 */
const VISIBLE_DIGITS = 4;

/**
 * "1234567890" → "xxxxxx7890".
 *
 * Separators the instructor typed are kept, so a number entered as
 * "123-4-56789-0" still reads like a bank account afterwards; only digits count
 * towards the four that stay visible. A number of four digits or fewer is
 * masked completely — being short is not a reason to hand it over.
 */
export function maskAccountNumber(accountNumber: string): string {
  const digitCount = countDigits(accountNumber);
  if (digitCount === 0) {
    return '';
  }

  const hideCount = digitCount > VISIBLE_DIGITS ? digitCount - VISIBLE_DIGITS : digitCount;

  let seen = 0;
  return [...accountNumber]
    .map((char) => {
      if (!isDigit(char)) {
        return char;
      }
      seen += 1;
      return seen <= hideCount ? 'x' : char;
    })
    .join('');
}

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9';
}

function countDigits(value: string): number {
  let count = 0;
  for (const char of value) {
    if (isDigit(char)) {
      count += 1;
    }
  }
  return count;
}
