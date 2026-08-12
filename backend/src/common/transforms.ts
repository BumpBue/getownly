import { Transform } from 'class-transformer';

/**
 * Typed wrappers around class-transformer, whose own callback hands back
 * `any`. Non-string input is passed through untouched so the validator that
 * follows is the one that reports the problem.
 */

export const TrimAndLowercase = () =>
  Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );

export const Trim = () =>
  Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  );
