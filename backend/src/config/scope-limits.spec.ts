import {
  COURSE_MAX_PRICE_BAHT,
  COURSE_MAX_STORAGE_BYTES,
  PAYOUT_MIN_AMOUNT_BAHT,
  QUIZ_PASS_SCORE_MAX,
  QUIZ_PASS_SCORE_MIN,
  TOPUP_REVIEW_TARGET_HOURS,
  UPLOAD_MAX_MB,
  formatBytesThai,
} from '@getownly/shared';
import { describe, expect, it } from 'vitest';
import { maxBytesFor, maxMbFor } from '@/modules/uploads/upload-rules';

/**
 * The numbers the scope document (ทก.01) fixes, asserted literally.
 *
 * Every other test in the suite reads these constants rather than hard-coding
 * a size, which is what keeps the code and the limits in step — but it also
 * means a typo in limits.ts would move every one of those tests with it and
 * still pass. This file is the one place the values are written out by hand,
 * so that a change to any of them has to be deliberate.
 */
describe('scope limits (ทก.01)', () => {
  it('A4: caps a course price at 10,000 baht', () => {
    expect(COURSE_MAX_PRICE_BAHT).toBe(10_000);
  });

  it('A6: caps one lesson video at 150 MB', () => {
    expect(UPLOAD_MAX_MB.video).toBe(150);
    expect(maxMbFor('video')).toBe(150);
    expect(maxBytesFor('video')).toBe(150 * 1024 * 1024);
  });

  it('A6: caps one course at 1 GB of storage', () => {
    expect(COURSE_MAX_STORAGE_BYTES).toBe(1024 * 1024 * 1024);
    expect(formatBytesThai(COURSE_MAX_STORAGE_BYTES)).toBe('1 GB');
  });

  it('A7: allows a pass mark between 60 and 100', () => {
    expect(QUIZ_PASS_SCORE_MIN).toBe(60);
    expect(QUIZ_PASS_SCORE_MAX).toBe(100);
  });

  it('D3: targets a 24 hour top-up review', () => {
    expect(TOPUP_REVIEW_TARGET_HOURS).toBe(24);
  });
});

/**
 * Numbers this project chose, which the scope document does not mention.
 *
 * Kept in a describe block of its own so that reading the test output alone
 * tells an examiner which limits are commitments made in ทก.01 and which are
 * decisions the implementation is free to revisit.
 */
describe('limits beyond ทก.01 (extensions)', () => {
  it('payouts: will not accept a withdrawal below 500 baht', () => {
    expect(PAYOUT_MIN_AMOUNT_BAHT).toBe(500);
  });
});

describe('quota wording', () => {
  it('names megabytes below a gigabyte and gigabytes above it', () => {
    expect(formatBytesThai(74 * 1024 * 1024)).toBe('74 MB');
    expect(formatBytesThai(950 * 1024 * 1024)).toBe('950 MB');
    expect(formatBytesThai(0)).toBe('0 MB');
  });
});
