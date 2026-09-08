/**
 * ทก.01 ข้อ 2.3.4 — Responsive check, re-runnable.
 *
 * Drives a real browser over every main screen of all three roles at phone,
 * tablet and desktop widths, and fails on more than horizontal overflow: it
 * also reports controls pushed outside the viewport and tap targets too short
 * to hit on a phone, because a page can fit its width and still be unusable.
 *
 * Needs a dev server and an API already running against a seeded database —
 * see frontend/test/README.md. It reads the site, it never writes to it.
 *
 * Usage:  pnpm --filter frontend test:responsive
 *         pnpm --filter frontend test:responsive -- --screenshots
 */
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { findBrowser } from './find-browser.mjs';
import { ACCOUNTS, CHROME_LABELS, MIN_TOUCH_HEIGHT, WIDTHS } from './responsive.config.mjs';

const BASE = process.env.RESPONSIVE_BASE_URL ?? 'http://localhost:3000';
const KEEP_SCREENSHOTS = process.argv.includes('--screenshots');

/**
 * Which findings fail the run.
 *
 * Something outside the viewport, or a page wider than the screen, means a
 * control cannot be reached at all — that is a defect. A tap target under the
 * height guideline is a judgement call: a text link inside a heading is short
 * on a phone and always will be, and failing the run over it would leave this
 * check permanently red and therefore ignored. Those print as warnings so they
 * stay visible without crying wolf.
 */
const BLOCKING_KINDS = ['OVERFLOW', 'OFFSCREEN', 'TABLE', 'ERROR'];
const isBlocking = (problem) => BLOCKING_KINDS.some((kind) => problem.startsWith(kind));
const OUT_DIR = 'test/responsive-output';

/**
 * Everything measured in one pass inside the page, because reaching back into
 * Node for each element would take minutes rather than milliseconds.
 */
function auditInPage({ width, minTouch, chromeLabels }) {
  const doc = document.documentElement;
  const problems = [];

  if (doc.scrollWidth > doc.clientWidth + 1) {
    problems.push(`OVERFLOW หน้ากว้าง ${doc.scrollWidth}px ในจอ ${doc.clientWidth}px`);
  }

  const isVisible = (el) => {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const labelOf = (el) =>
    (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40);

  const controls = [...document.querySelectorAll('button, a, input, select, textarea')];

  for (const el of controls.filter(isVisible)) {
    const label = labelOf(el);
    if (chromeLabels.includes(label)) {
      continue;
    }

    const rect = el.getBoundingClientRect();

    if (rect.right > width + 1 || rect.left < -1) {
      problems.push(
        `OFFSCREEN "${label}" อยู่ที่ x ${Math.round(rect.left)}..${Math.round(rect.right)}`,
      );
    }

    if (width <= 400) {
      // A link inside a sentence is read, not tapped like a button, and a
      // checkbox has its own label to hit — neither is judged by height.
      const isInlineLink = el.tagName === 'A' && el.closest('p, li, span, dd, td') !== null;
      const isCheckable = el.tagName === 'INPUT' && ['checkbox', 'radio'].includes(el.type);

      if (!isInlineLink && !isCheckable && rect.height < minTouch) {
        problems.push(
          `SMALL "${label}" ขนาด ${Math.round(rect.width)}x${Math.round(rect.height)}`,
        );
      }
    }
  }

  for (const table of [...document.querySelectorAll('table')].filter(isVisible)) {
    const scroller = table.closest('[class*="overflow-x"], [style*="overflow-x"]');
    if (!scroller && table.getBoundingClientRect().width > width + 1) {
      problems.push('TABLE กว้างเกินจอโดยไม่มีตัวเลื่อนแนวนอน');
    }
  }

  return problems;
}

const browser = await chromium.launch({ executablePath: findBrowser() });
if (KEEP_SCREENSHOTS) {
  mkdirSync(OUT_DIR, { recursive: true });
}

/**
 * Signs in once per role and keeps the cookies. Logging in per screen would be
 * 84 logins, which is both slow and a source of timeouts that look like layout
 * failures but are not.
 */
async function sessionFor(role) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="identifier"]', ACCOUNTS[role].id);
  await page.fill('input[name="password"]', ACCOUNTS[role].password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 45000 });

  const state = await context.storageState();
  await context.close();
  return state;
}

const sessions = {
  student: await sessionFor('student'),
  instructor: await sessionFor('instructor'),
  admin: await sessionFor('admin'),
};

const results = [];

async function check(role, name, path, prepare) {
  for (const width of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      storageState: sessions[role],
    });
    const page = await context.newPage();
    const id = `${role}-${name}-${width}`;

    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 45000 });
      if (prepare) {
        await prepare(page);
      }
      await page.waitForTimeout(500);

      const problems = await page.evaluate(auditInPage, {
        width,
        minTouch: MIN_TOUCH_HEIGHT,
        chromeLabels: CHROME_LABELS,
      });

      if (KEEP_SCREENSHOTS) {
        await page.screenshot({ path: `${OUT_DIR}/${id}.png`, fullPage: true });
      }

      const blocking = problems.filter(isBlocking);
      results.push({ id, problems, blocking });

      const mark = blocking.length > 0 ? 'FAIL' : problems.length > 0 ? 'warn' : 'ok  ';
      console.log(`${mark} ${id}`);
      for (const problem of [...new Set(problems)]) {
        console.log(`       ${problem}`);
      }
    } catch (error) {
      const message = error.message.split('\n')[0];
      results.push({ id, problems: [`ERROR ${message}`], blocking: [`ERROR ${message}`] });
      console.log(`ERR  ${id}: ${message}`);
    } finally {
      await context.close();
    }
  }
}

/** Ids come from the seeded data rather than being written down here. */
async function lookUp(role, work) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: sessions[role],
  });
  const page = await context.newPage();
  const value = await work(page);
  await context.close();
  return value;
}

const courseId = await lookUp('instructor', async (page) => {
  await page.goto(`${BASE}/instructor`, { waitUntil: 'networkidle' });
  const href = await page
    .locator('a[href^="/instructor/courses/"]:not([href$="/new"])')
    .first()
    .getAttribute('href');
  return href.split('/').pop();
});

const { learnCourseId, publicCoursePath } = await lookUp('student', async (page) => {
  await page.goto(`${BASE}/my-courses`, { waitUntil: 'networkidle' });
  const learnHref = await page
    .locator('a[href^="/learn/"]')
    .first()
    .getAttribute('href')
    .catch(() => null);

  await page.goto(`${BASE}/courses`, { waitUntil: 'networkidle' });
  const coursePath = await page.locator('a[href^="/courses/"]').first().getAttribute('href');

  return {
    learnCourseId: learnHref ? learnHref.split('/')[2] : null,
    publicCoursePath: coursePath,
  };
});

// --- ผู้เรียน ---------------------------------------------------------------
await check('student', 'home', '/home');
await check('student', 'catalog', '/courses');
await check('student', 'catalog-filtered', '/courses?search=Maya&sort=price_asc');
await check('student', 'course-detail', publicCoursePath);
await check('student', 'my-courses', '/my-courses');
await check('student', 'wallet', '/wallet');
await check('student', 'topup', '/wallet/topup');
await check('student', 'profile', '/profile');
if (learnCourseId) {
  await check('student', 'learn', `/learn/${learnCourseId}`);
  await check('student', 'qna', `/learn/${learnCourseId}/qna`);
}

// --- ผู้สอน -----------------------------------------------------------------
await check('instructor', 'dashboard', '/instructor');
await check('instructor', 'course-general', `/instructor/courses/${courseId}`);
await check('instructor', 'course-curriculum', `/instructor/courses/${courseId}`, (page) =>
  page.getByRole('button', { name: 'เนื้อหาบทเรียน', exact: true }).click(),
);
await check('instructor', 'course-quizzes', `/instructor/courses/${courseId}`, (page) =>
  page.getByRole('button', { name: 'แบบทดสอบ', exact: true }).click(),
);
await check('instructor', 'course-students', `/instructor/courses/${courseId}`, (page) =>
  page.getByRole('button', { name: 'ผู้เรียน', exact: true }).click(),
);
await check('instructor', 'course-new', '/instructor/courses/new');
await check('instructor', 'reports', '/instructor/reports');
await check('instructor', 'qna-inbox', '/instructor/qna');
await check('instructor', 'wallet', '/wallet');
await check('instructor', 'payouts', '/instructor/payouts');
// The bank form is a second state of the same page, and the only place in the
// application that shows an account number in full - worth its own look.
await check('instructor', 'payouts-bank-form', '/instructor/payouts', (page) =>
  page.getByRole('button', { name: /บัญชีธนาคาร/ }).first().click(),
);
// The bank list open: sixteen rows and a search box, on a screen 375px wide.
await check('instructor', 'payouts-bank-list', '/instructor/payouts', async (page) => {
  await page.getByRole('button', { name: /บัญชีธนาคาร/ }).first().click();
  await page.waitForSelector('#bank-name', { timeout: 15000 });
  await page.click('#bank-name');
});
await check('instructor', 'profile', '/profile');

// --- ผู้ดูแลระบบ -------------------------------------------------------------
await check('admin', 'dashboard', '/admin');
await check('admin', 'topups', '/admin/topups');
await check('admin', 'payouts', '/admin/payouts');
await check('admin', 'payouts-all', '/admin/payouts', (page) =>
  page.getByRole('button', { name: 'ทั้งหมด', exact: true }).first().click(),
);
await check('admin', 'courses', '/admin/courses');
await check('admin', 'content-reports', '/admin/content-reports');
await check('admin', 'users', '/admin/users');
await check('admin', 'categories', '/admin/categories');
await check('admin', 'reports', '/admin/reports');
await check('admin', 'profile', '/profile');

await browser.close();

const failed = results.filter((result) => result.blocking.length > 0);
const warned = results.filter(
  (result) => result.blocking.length === 0 && result.problems.length > 0,
);

const report = [
  `ตรวจ ${results.length} หน้าจอ (${results.length / WIDTHS.length} หน้า x ${WIDTHS.join(', ')} px)`,
  `ไม่ผ่าน ${failed.length} · เตือน ${warned.length} · ` +
    `ผ่าน ${results.length - failed.length - warned.length}`,
  ...failed.map(
    (result) => `\n[ไม่ผ่าน] ${result.id}\n  ${[...new Set(result.blocking)].join('\n  ')}`,
  ),
  ...warned.map(
    (result) => `\n[เตือน] ${result.id}\n  ${[...new Set(result.problems)].join('\n  ')}`,
  ),
].join('\n');

console.log(`\n${report}`);

if (KEEP_SCREENSHOTS) {
  writeFileSync(`${OUT_DIR}/report.txt`, report, 'utf8');
  console.log(`\nภาพหน้าจอและรายงานอยู่ที่ ${OUT_DIR}/`);
}

process.exit(failed.length === 0 ? 0 : 1);
