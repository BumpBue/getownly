/**
 * ซ้อมเส้นทางสาธิตทั้งเส้น ผ่านเบราว์เซอร์จริง ไม่ยิง API ตรง
 * Runs against the containerised stack on getownly_docker, starting from a
 * database that holds nothing but one admin.
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { findBrowser } from './find-browser.mjs';

const BASE = process.env.DEMO_BASE_URL ?? 'http://localhost:3000';
const OUT_DIR = 'test/demo-flow-output';

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ executablePath: findBrowser() });

const started = Date.now();
const steps = [];
const notes = [];
let shot = 0;

function log(msg) {
  const at = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[${at.padStart(6)}s] ${msg}`);
}

/**
 * Runs one step of the demo path, timing it and stopping the rehearsal on
 * the first failure — a later step reading a course an earlier one never
 * created would only report a second, invented problem.
 *
 * `actorOnFailure` is whose screen to photograph when it goes wrong. A
 * picture of the moment it broke is what turns "timeout waiting for a
 * selector" into something anyone can diagnose.
 */
async function step(name, fn, actorOnFailure) {
  const t0 = Date.now();
  try {
    await fn();
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    steps.push({ name, ok: true, secs });
    log(`OK   ${name}  (${secs}s)`);
  } catch (error) {
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    steps.push({ name, ok: false, secs, error: error.message.split('\n')[0] });
    log(`FAIL ${name}  (${secs}s)  ${error.message.split('\n')[0]}`);
    if (actorOnFailure) {
      try {
        await capture(actorOnFailure.page, 'failure');
      } catch {
        // The page may already be gone; the original error is the one to keep.
      }
    }
    throw error;
  }
}

function note(text) {
  notes.push(text);
  log(`  note: ${text}`);
}

async function newActor(label) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => note(`${label} console error: ${String(e).slice(0, 120)}`));
  return { context, page, label };
}

async function capture(page, name) {
  shot += 1;
  await page.screenshot({
    path: `${OUT_DIR}/${String(shot).padStart(2, '0')}-${name}.png`,
    fullPage: true,
  });
}

async function login(page, id, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="identifier"]', id);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
}

async function register(page, { email, username, password, displayName, role }) {
  await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: role === 'INSTRUCTOR' ? /ผู้สอน/ : /ผู้เรียน/ }).first().click();
  await page.fill('#displayName', displayName);
  await page.fill('#email', email);
  await page.fill('#username', username);
  await page.fill('#password', password);
  const confirm = page.locator('#confirmPassword');
  if (await confirm.count()) {
    await confirm.fill(password);
  }
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith('/register'), { timeout: 30000 });
}

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Smallest thing a browser and MinIO will both accept as an MP4. */
const MP4 = Buffer.from(
  'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAhtZGF0',
  'base64',
);

const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF\n',
  'latin1',
);

const admin = await newActor('admin');
const teacher = await newActor('instructor');
const learner = await newActor('student');

const PRICE = '1500';
const COMMISSION_PERCENT = 25;
let courseUrl = null;

try {
  // --- 0. admin signs in and creates a category (nothing else can) ---------
  await step('0. ADMIN เข้าระบบ และสร้างหมวดหมู่', async () => {
    await login(admin.page, 'admin@getownly.local', 'Admin@1234');
    await admin.page.goto(`${BASE}/admin/categories`, { waitUntil: 'networkidle' });
    await admin.page.getByRole('button', { name: 'เพิ่มหมวดหมู่', exact: true }).first().click();
    await admin.page.waitForSelector('#category-name', { timeout: 15000 });
    await admin.page.fill('#category-name', 'การออกแบบกราฟิก');
    await admin.page
      .locator('form')
      .filter({ has: admin.page.locator('#category-name') })
      .getByRole('button', { name: /บันทึก|เพิ่มหมวดหมู่|สร้าง/ })
      .last()
      .click();
    await admin.page.waitForTimeout(2500);
    await capture(admin.page, 'admin-category');
  }, admin);

  // --- 1. instructor registers, builds a course ---------------------------
  await step('1a. ผู้สอนสมัครสมาชิก', async () => {
    await register(teacher.page, {
      email: 'kru@demo.local',
      username: 'kru.demo',
      password: 'Password@1234',
      displayName: 'ครูสาธิต ใจดี',
      role: 'INSTRUCTOR',
    });
    await capture(teacher.page, 'instructor-registered');
  }, teacher);

  await step('1b. ผู้สอนสร้างคอร์สและตั้งราคา', async () => {
    await teacher.page.goto(`${BASE}/instructor/courses/new`, { waitUntil: 'networkidle' });
    await teacher.page.fill('#title', 'ออกแบบโปสเตอร์ด้วย Figma');
    await teacher.page.fill(
      '#description',
      'คอร์สสาธิตสำหรับการซ้อมเส้นทางการใช้งาน สอนออกแบบโปสเตอร์ตั้งแต่เริ่มต้นจนส่งงานจริง',
    );
    await teacher.page.locator('#categoryId').selectOption({ index: 1 });
    await teacher.page.fill('#price', PRICE);
    await teacher.page.getByRole('button', { name: /สร้างคอร์ส|บันทึก/ }).last().click();
    // Not just /courses/<something>: "new" matches that too, and waiting on it
    // would capture the create page as the course page.
    await teacher.page.waitForURL(
      (url) => /^\/instructor\/courses\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith('/new'),
      { timeout: 30000 },
    );
    courseUrl = teacher.page.url();
    if (courseUrl.endsWith('/new')) {
      throw new Error('สร้างคอร์สแล้วไม่ถูกพาไปหน้าคอร์ส');
    }
    await capture(teacher.page, 'course-created');
  }, teacher);

  await step('1c. ผู้สอนอัปโหลดภาพหน้าปก', async () => {
    await teacher.page.goto(courseUrl, { waitUntil: 'networkidle' });
    await teacher.page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: PNG });
    // The browser PUTs straight to MinIO, so this is a real round trip.
    await teacher.page.waitForTimeout(6000);
    await capture(teacher.page, 'cover-uploaded');
  }, teacher);

  await step('1d. ผู้สอนเพิ่มบทเรียน อัปโหลดวิดีโอและแนบเอกสาร', async () => {
    await teacher.page.goto(courseUrl, { waitUntil: 'networkidle' });
    await teacher.page.getByRole('button', { name: 'เนื้อหาบทเรียน', exact: true }).click();
    await teacher.page.waitForSelector('#new-lesson', { timeout: 15000 });
    await teacher.page.waitForTimeout(800);

    await teacher.page.fill('#new-lesson', 'รู้จักเครื่องมือพื้นฐานของ Figma');
    // The field submits on Enter, which avoids matching a button whose
    // accessible name also carries an icon.
    await teacher.page.press('#new-lesson', 'Enter');
    await teacher.page.waitForSelector('text=บทที่ 1', { timeout: 20000 });

    const files = teacher.page.locator('input[type="file"]');
    const count = await files.count();
    note(`ช่องอัปโหลดในแท็บเนื้อหา: ${count} ช่อง`);

    await files.nth(0).setInputFiles({ name: 'lesson.mp4', mimeType: 'video/mp4', buffer: MP4 });
    await teacher.page.waitForTimeout(7000);

    const after = teacher.page.locator('input[type="file"]');
    await after
      .nth((await after.count()) - 1)
      .setInputFiles({ name: 'worksheet.pdf', mimeType: 'application/pdf', buffer: PDF });
    await teacher.page.waitForTimeout(7000);

    await capture(teacher.page, 'lesson-with-files');
  }, teacher);

  await step('1e. ผู้สอนสร้างแบบทดสอบผ่านหน้าเว็บ', async () => {
    await teacher.page.goto(courseUrl, { waitUntil: 'networkidle' });
    await teacher.page.getByRole('button', { name: 'แบบทดสอบ', exact: true }).click();
    await teacher.page.waitForSelector('text=แบบทดสอบท้ายบทเรียน', { timeout: 15000 });
    await teacher.page.getByRole('button', { name: /สร้างแบบทดสอบ/ }).first().click();
    await teacher.page.waitForSelector('#quiz-title', { timeout: 15000 });

    await teacher.page.fill('#quiz-title', 'แบบทดสอบท้ายบทที่ 1');
    await teacher.page.fill('#quiz-pass-score', '60');

    const q1 = teacher.page.locator('textarea').first();
    await q1.fill('เครื่องมือใดใช้สำหรับวาดรูปทรงสี่เหลี่ยมใน Figma');
    const choices = teacher.page.locator('input[aria-label^="ตัวเลือก"]');
    await choices.nth(0).fill('Rectangle');
    await choices.nth(1).fill('Pen');
    await teacher.page.locator('input[type="radio"]').first().check();

    await teacher.page.getByRole('button', { name: /บันทึกแบบทดสอบ/ }).click();
    await teacher.page.waitForTimeout(2500);
    await capture(teacher.page, 'quiz-created');
  }, teacher);

  await step('1f. ผู้สอนส่งคอร์สให้อนุมัติ', async () => {
    await teacher.page.goto(courseUrl, { waitUntil: 'networkidle' });
    await teacher.page.getByRole('button', { name: /ส่งตรวจสอบ/ }).first().click();
    await teacher.page.waitForTimeout(3000);
    await capture(teacher.page, 'submitted-for-review');

    // Assert rather than assume: submission is refused when the course is
    // incomplete, and a silent pass here would hide that from the next step.
    const text = await teacher.page.locator('body').innerText();
    if (!text.includes('รอตรวจสอบ')) {
      throw new Error(`ส่งตรวจสอบแล้วสถานะไม่เปลี่ยนเป็น "รอตรวจสอบ" — ${text.slice(0, 200)}`);
    }
  }, teacher);

  // --- 2. admin approves and sets the commission --------------------------
  await step('2a. ADMIN อนุมัติคอร์ส', async () => {
    await admin.page.goto(`${BASE}/admin/courses`, { waitUntil: 'networkidle' });
    await admin.page.getByRole('button', { name: /^อนุมัติ/ }).first().click();
    await admin.page.waitForTimeout(2500);
    await capture(admin.page, 'course-approved');
  }, admin);

  await step(`2b. ADMIN ตั้งส่วนแบ่งของผู้สอนเป็น ${COMMISSION_PERCENT}%`, async () => {
    await admin.page.goto(`${BASE}/admin/users`, { waitUntil: 'networkidle' });
    await admin.page.getByRole('button', { name: /แก้ไขส่วนแบ่ง/ }).first().click();
    await admin.page.waitForTimeout(800);
    const rate = admin.page.locator('input[type="number"]').first();
    await rate.fill(String(COMMISSION_PERCENT));
    await admin.page.getByRole('button', { name: /^บันทึก/ }).last().click();
    await admin.page.waitForTimeout(2000);
    await capture(admin.page, 'commission-set');
  }, admin);

  // --- 3. student registers, finds the course, tops up --------------------
  await step('3a. ผู้เรียนสมัครสมาชิก', async () => {
    await register(learner.page, {
      email: 'nong@demo.local',
      username: 'nong.demo',
      password: 'Password@1234',
      displayName: 'น้องสาธิต ตั้งใจเรียน',
      role: 'STUDENT',
    });
  }, learner);

  await step('3b. ผู้เรียนค้นหาคอร์สด้วยตัวกรองผู้สอน', async () => {
    await learner.page.goto(`${BASE}/courses`, { waitUntil: 'networkidle' });
    const select = learner.page.locator('#filter-instructor');
    if ((await select.count()) === 0) {
      throw new Error('ไม่พบตัวกรองผู้สอนในหน้าแคตตาล็อก');
    }
    // The dropdown lists only instructors with something published, so after
    // approval there is exactly one option besides "ผู้สอนทุกคน".
    await select.selectOption({ index: 1 });
    const chosen = await select.locator('option:checked').innerText();
    note(`เลือกผู้สอน: ${chosen.trim()}`);
    await learner.page.getByRole('button', { name: /ค้นหา|กรอง|ใช้ตัวกรอง/ }).first().click();
    await learner.page.waitForTimeout(2000);
    const found = await learner.page.locator('a[href^="/courses/"]').count();
    if (found === 0) {
      throw new Error('กรองตามผู้สอนแล้วไม่เจอคอร์ส');
    }
    note(`กรองตามผู้สอนแล้วเจอ ${found} คอร์ส`);
    await capture(learner.page, 'filtered-by-instructor');
  }, learner);

  await step('3c. ผู้เรียนเติมเงินและแนบสลิป', async () => {
    await learner.page.goto(`${BASE}/wallet/topup`, { waitUntil: 'networkidle' });
    await learner.page.fill('#topup-amount', '2000');
    await learner.page.getByRole('button', { name: /สร้าง QR/ }).click();
    await learner.page.waitForTimeout(2500);

    // A 1x1 PNG standing in for a transfer slip.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    await learner.page.locator('input[type="file"]').first().setInputFiles({
      name: 'slip.png',
      mimeType: 'image/png',
      buffer: png,
    });
    await learner.page.waitForTimeout(3000);
    await learner.page.getByRole('button', { name: /แจ้งการโอนเงิน/ }).click();
    await learner.page.waitForTimeout(3000);
    await capture(learner.page, 'topup-submitted');
  }, learner);

  // --- 4. admin approves the top-up ---------------------------------------
  await step('4. ADMIN อนุมัติการเติมเงิน (ดูคอลัมน์ "รอมาแล้ว")', async () => {
    await admin.page.goto(`${BASE}/admin/topups`, { waitUntil: 'networkidle' });
    const body = await admin.page.locator('body').innerText();
    if (!body.includes('รอมาแล้ว')) {
      note('ไม่พบคอลัมน์ "รอมาแล้ว" ที่ 1440px');
    }
    await capture(admin.page, 'topup-queue');
    await admin.page.getByRole('button', { name: /^ตรวจสอบ/ }).first().click();
    await admin.page.waitForTimeout(1200);
    await admin.page.getByRole('button', { name: /^อนุมัติ/ }).last().click();
    await admin.page.waitForTimeout(2500);
    await capture(admin.page, 'topup-approved');
  }, admin);

  // --- 5. student buys, learns, sits the quiz -----------------------------
  await step('5a. ผู้เรียนซื้อคอร์ส', async () => {
    await learner.page.goto(`${BASE}/courses`, { waitUntil: 'networkidle' });
    const href = await learner.page.locator('a[href^="/courses/"]').first().getAttribute('href');
    await learner.page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
    await learner.page.getByRole('button', { name: /ซื้อคอร์สนี้/ }).first().click();
    await learner.page.waitForTimeout(3500);
    await capture(learner.page, 'purchased');
  }, learner);

  await step('5b. ผู้เรียนเข้าเรียนและทำข้อสอบ', async () => {
    await learner.page.goto(`${BASE}/my-courses`, { waitUntil: 'networkidle' });
    const learnHref = await learner.page.locator('a[href^="/learn/"]').first().getAttribute('href');
    await learner.page.goto(`${BASE}${learnHref}`, { waitUntil: 'networkidle' });
    await learner.page.waitForTimeout(2000);
    await capture(learner.page, 'classroom');

    // The CTA is <Button asChild><Link>, so it is an anchor with button
    // styling — role "link", not "button".
    await learner.page.getByRole('link', { name: /ทำแบบทดสอบ/ }).first().click();
    await learner.page.waitForURL(/\/quiz\//, { timeout: 20000 });
    // Choices are aria-pressed buttons, not radio inputs.
    const choices = learner.page.locator('button[aria-pressed]');
    await choices.first().waitFor({ timeout: 20000 });
    await choices.first().click();
    await learner.page.getByRole('button', { name: 'ส่งคำตอบ', exact: true }).first().click();
    await learner.page.waitForTimeout(3000);
    await capture(learner.page, 'quiz-result');
  }, learner);

  // --- 6. Q&A -------------------------------------------------------------
  await step('6a. ผู้เรียนตั้งคำถามในกระดาน', async () => {
    await learner.page.goto(`${BASE}/my-courses`, { waitUntil: 'networkidle' });
    const learnHref = await learner.page.locator('a[href^="/learn/"]').first().getAttribute('href');
    const courseId = learnHref.split('/')[2];
    await learner.page.goto(`${BASE}/learn/${courseId}/qna`, { waitUntil: 'networkidle' });
    await learner.page.getByRole('button', { name: 'ตั้งคำถามใหม่', exact: true }).first().click();
    await learner.page.waitForSelector('#qna-title', { timeout: 15000 });
    await learner.page.fill('#qna-title', 'เริ่มต้นควรตั้งขนาดโปสเตอร์เท่าไร');
    await learner.page.fill('#qna-body', 'อยากทราบว่าถ้าจะพิมพ์จริงควรตั้งขนาดและความละเอียดเท่าไรครับ');
    await learner.page.getByRole('button', { name: 'ส่งคำถาม', exact: true }).click();
    await learner.page.waitForTimeout(2500);
    await capture(learner.page, 'question-asked');
  }, learner);

  await step('6b. ผู้สอนตอบคำถาม', async () => {
    await teacher.page.goto(`${BASE}/instructor/qna`, { waitUntil: 'networkidle' });
    await capture(teacher.page, 'qna-inbox');
    await teacher.page.locator('a[href*="/qna/"]').first().click();
    await teacher.page.waitForTimeout(2000);
    await teacher.page.locator('textarea').first().fill('แนะนำ A3 ที่ 300 DPI ครับ ถ้าพิมพ์จริงจะคมพอ');
    await teacher.page.getByRole('button', { name: 'ส่งคำตอบ', exact: true }).first().click();
    await teacher.page.waitForTimeout(2500);
    await capture(teacher.page, 'answered');
  }, teacher);

  // --- 7. instructor reads the roster and the split -----------------------
  await step('7a. ผู้สอนเปิดรายชื่อผู้เรียน (A9)', async () => {
    await teacher.page.goto(courseUrl, { waitUntil: 'networkidle' });
    await teacher.page.getByRole('button', { name: 'ผู้เรียน', exact: true }).click();
    await teacher.page.waitForTimeout(2500);
    const text = await teacher.page.locator('body').innerText();
    if (!text.includes('น้องสาธิต')) {
      throw new Error('ไม่พบชื่อผู้เรียนในรายชื่อ');
    }
    note('รายชื่อผู้เรียนแสดงชื่อ "น้องสาธิต" ถูกต้อง');
    await capture(teacher.page, 'roster');
  }, teacher);

  await step('7b. ผู้สอนเปิดตารางส่วนแบ่งรายธุรกรรม (A10) และตรวจตัวเลข', async () => {
    await teacher.page.goto(`${BASE}/instructor/reports`, { waitUntil: 'networkidle' });
    await teacher.page.waitForTimeout(3000);
    await capture(teacher.page, 'earnings-table');

    const text = await teacher.page.locator('body').innerText();
    const expectedFee = (Number(PRICE) * COMMISSION_PERCENT) / 100;
    const expectedNet = Number(PRICE) - expectedFee;
    const money = (n) => n.toLocaleString('th-TH', { minimumFractionDigits: 2 });

    note(`คาดหวัง: ราคา ${money(Number(PRICE))} · rate ${COMMISSION_PERCENT}.00% · หัก ${money(expectedFee)} · สุทธิ ${money(expectedNet)}`);

    const checks = [
      [`ราคาขาย ${money(Number(PRICE))}`, text.includes(money(Number(PRICE)))],
      [`อัตราส่วนแบ่ง ${COMMISSION_PERCENT}.00%`, text.includes(`${COMMISSION_PERCENT}.00%`)],
      [`จำนวนที่ถูกหัก ${money(expectedFee)}`, text.includes(money(expectedFee))],
      [`ยอดสุทธิ ${money(expectedNet)}`, text.includes(money(expectedNet))],
    ];
    for (const [what, ok] of checks) {
      note(`${ok ? 'ตรง' : 'ไม่ตรง'}: ${what}`);
    }
    if (checks.some(([, ok]) => !ok)) {
      throw new Error('ตัวเลขในตาราง A10 ไม่ตรงกับราคาและ rate ที่ตั้งไว้');
    }
  }, teacher);

  // --- 8. admin reports ----------------------------------------------------
  await step('8. ADMIN เปิดรายงานสรุปและตรวจยอด', async () => {
    await admin.page.goto(`${BASE}/admin/reports`, { waitUntil: 'networkidle' });
    await admin.page.waitForTimeout(3500);
    await capture(admin.page, 'admin-reports');

    const text = await admin.page.locator('body').innerText();
    const money = (n) => n.toLocaleString('th-TH', { minimumFractionDigits: 2 });
    const fee = (Number(PRICE) * COMMISSION_PERCENT) / 100;

    note(`ยอดขายรวมควรเป็น ${money(Number(PRICE))} · ส่วนแบ่งแพลตฟอร์มควรเป็น ${money(fee)}`);
    note(`พบยอดขาย: ${text.includes(money(Number(PRICE)))}`);
    note(`พบส่วนแบ่ง: ${text.includes(money(fee))}`);
  }, admin);
} catch {
  // The failing step is already recorded; fall through to the summary.
}

console.log('\n================ สรุป ================');
for (const s of steps) {
  console.log(`${s.ok ? 'ok  ' : 'FAIL'}  ${s.secs.padStart(5)}s  ${s.name}${s.error ? `  << ${s.error}` : ''}`);
}
console.log(`\nรวม ${((Date.now() - started) / 1000).toFixed(1)} วินาที · สำเร็จ ${steps.filter((s) => s.ok).length}/${steps.length} ขั้น`);
if (notes.length > 0) {
  console.log('\n--- บันทึกระหว่างทาง ---');
  for (const n of notes) {
    console.log(`  ${n}`);
  }
}

await browser.close();
