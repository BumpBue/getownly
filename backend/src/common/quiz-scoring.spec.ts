import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isPassingScore, summariseAttempts } from './quiz-scoring';

describe('quiz scoring', () => {
  it('passes on the mark, not only above it', () => {
    expect(isPassingScore(60, 60)).toBe(true);
    expect(isPassingScore(59, 60)).toBe(false);
    expect(isPassingScore(100, 100)).toBe(true);
  });

  it('reports nothing at all before the first attempt', () => {
    expect(summariseAttempts([])).toEqual({
      bestScore: null,
      hasPassed: false,
      attemptCount: 0,
    });
  });

  it('keeps the highest score and the verdict as separate facts', () => {
    // 65 cleared the bar of 60 it was sat under. 68 is higher but was sat at
    // 70 and did not clear it. Both statements are true at once, which is
    // exactly why "best score beats the current mark" is the wrong rule.
    const standing = summariseAttempts([
      { score: 65, passScoreSnapshot: 60 },
      { score: 68, passScoreSnapshot: 70 },
    ]);

    expect(standing).toEqual({ bestScore: 68, hasPassed: true, attemptCount: 2 });
  });

  it('does not pass a student whose every attempt missed its own mark', () => {
    expect(
      summariseAttempts([
        { score: 59, passScoreSnapshot: 60 },
        { score: 69, passScoreSnapshot: 70 },
      ]),
    ).toEqual({ bestScore: 69, hasPassed: false, attemptCount: 2 });
  });

  it('counts a score of zero as an attempt, unlike never having sat it', () => {
    expect(summariseAttempts([{ score: 0, passScoreSnapshot: 60 }])).toEqual({
      bestScore: 0,
      hasPassed: false,
      attemptCount: 1,
    });
  });
});

/**
 * (ฏ) A verdict on a past attempt must never be re-derived from the quiz's
 * current pass mark.
 *
 * The individual services have tests proving they behave; this is the guard
 * against a *new* one being written that quietly reintroduces the comparison.
 * It reads the source rather than running it, because what it forbids is a
 * shape of code, not an outcome.
 */
describe('no service compares a score against a live pass mark', () => {
  const FORBIDDEN = [
    // e.g. `bestScore >= quiz.passScore` or `score >= quiz.passScore`
    /[A-Za-z.?]*[Ss]core\s*>=\s*(?:quiz\.|this\.quiz\.)?passScore\b(?!Snapshot)/,
    /[A-Za-z.?]*[Ss]core\s*>=\s*\w+\.passScore\b(?!Snapshot)/,
  ];

  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return walk(path);
      }
      return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [path] : [];
    });
  }

  it('holds across every file under src/', () => {
    const offenders: string[] = [];

    for (const path of walk(join(__dirname, '..'))) {
      // quiz-scoring.ts is where the comparison is allowed to live, against a
      // snapshot passed in by its caller.
      if (path.endsWith('quiz-scoring.ts')) {
        continue;
      }

      const source = readFileSync(path, 'utf8');
      for (const pattern of FORBIDDEN) {
        const match = pattern.exec(source);
        if (match) {
          offenders.push(`${path}: ${match[0]}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
