# AUDIT.md — ผลการตรวจสอบระบบ getownly

วันที่ตรวจ: 2026-08-12 · ตรวจโดยไล่โค้ดจริงใน `backend/` และ `frontend/` เทียบกับ [PLAN.md](PLAN.md) และ [CLAUDE.md](CLAUDE.md)
**รอบนี้ไม่ได้แก้โค้ดใดๆ** ทุกข้อในเอกสารนี้เป็นรายงาน ไม่ใช่การเปลี่ยนแปลง

---

## บทสรุปผู้บริหาร

| หัวข้อ | ผล |
|---|---|
| `pnpm build` (shared + backend + frontend) | ✅ ผ่าน exit 0 · frontend build 29 route |
| `pnpm lint` (backend + frontend) | ✅ ผ่าน ไม่มี warning เลยแม้แต่ข้อเดียว |
| `pnpm test` (backend, Vitest + PostgreSQL จริง) | ✅ **252/252 ผ่าน** 16 ไฟล์ ใช้เวลา 127 วินาที |
| `console.log` ค้างในโค้ดแอป | ✅ ไม่มี (มีเฉพาะใน `seed.ts` `demo-seed.ts` `main.ts` ซึ่งถูกต้อง) |
| `TODO` / `FIXME` / `@ts-ignore` ค้าง | ✅ ไม่มีเลยใน `backend/src` `frontend/src` `packages/` |
| hardcode URL | ✅ ผ่าน env ทุกจุด (ยกเว้น `next.config.ts` ดูข้อ I-6) |
| ปุ่มมี loading state | ✅ ครบทุกปุ่มที่ยิง API (ไล่ตรวจ 60 จุด) |
| useEffect มี cleanup | ✅ ตัวที่มี timer/interval มี cleanup ครบ |
| **error boundary** | ❌ **ไม่มีเลยทั้งระบบ** ดูข้อ C-1 |
| **จัดการ 401 ที่ refresh ไม่สำเร็จ** | ❌ **ไม่ redirect ไป login** ดูข้อ C-2 |
| **responsive 375px** | ⚠️ ตรวจจากโค้ดแล้ว พบล้นขอบจริงที่แถบนำทางของ STUDENT/INSTRUCTOR ดูข้อ I-9 |

**สรุป: คุณภาพโค้ดที่เขียนไปแล้วอยู่ในเกณฑ์ดีมาก ไม่มี error ตกค้าง ไม่มีหนี้ทางเทคนิคแบบ TODO ค้าง**
ปัญหาที่พบเป็น **ช่องว่างของฟีเจอร์ที่ยังไม่ได้ทำ** และ **กรณีขอบของ UX ที่ยังไม่มีใครรับผิดชอบ** ไม่ใช่บั๊กในของที่ทำไปแล้ว

---

# เรื่องที่ 1 — เทียบ PLAN.md กับโค้ดจริง

## 1.1 Entity (PLAN.md หัวข้อ 1 ระบุ 27 entity · schema จริงมี 20 model)

### ✅ ทำครบแล้ว (18)

| PLAN | ชื่อจริงใน schema | หมายเหตุ |
|---|---|---|
| User | `User` | รวม `commissionRate` แทน InstructorProfile |
| RefreshToken | `RefreshToken` | เก็บ SHA-256 + rotate |
| AuthToken | `PasswordResetToken` | ตัดชนิด `EMAIL_VERIFY` ออก |
| Category | `Category` | |
| Course | `Course` | ขาดหลายฟิลด์ ดู 1.1.2 |
| Lesson | `Lesson` | ผูกกับ Course ตรงๆ ไม่มี Section |
| LessonAttachment | `Material` | |
| Quiz | `Quiz` | ผูกกับ Lesson ไม่ใช่ Course |
| QuizQuestion | `QuizQuestion` | |
| QuizChoice | `QuizChoice` | |
| QuizAttempt | `QuizAttempt` | |
| QuizAnswer | `QuizAttemptAnswer` | |
| Enrollment | `Enrollment` | เก็บ snapshot `pricePaid` + `commissionRateSnapshot` เอง |
| LessonProgress | `LessonProgress` | |
| Wallet | `Account` kind `USER_WALLET` | ยอดสรุปอยู่ในผังบัญชีเลย |
| LedgerAccount | `Account` | |
| LedgerTransaction | `LedgerTransaction` | มี `idempotencyKey` unique ครบ |
| LedgerEntry | `LedgerEntry` | |
| TopUpRequest | `TopupRequest` | |
| QnaThread / QnaReply | `QnaThread` / `QnaReply` | |

### ⚠️ ทำบางส่วน (2)

| Entity | ขาดอะไร |
|---|---|
| **Course** | ไม่มี `slug` · `subtitle` · `level` · `ratingAvg` · `ratingCount` · `enrollmentCount` (นับสดทุกครั้ง) · `submittedAt` · `approvedAt` · `approvedById` · **ไม่มีสถานะ `UNPUBLISHED` ใน enum** |
| **MediaAsset** | ไม่มี model แยก — ไฟล์เก็บเป็น object key บนตารางที่ใช้งาน (`Course.coverKey` `Lesson.videoKey` `Material.fileKey`) ผลคือ **ไม่มีสถานะ `PENDING`/`READY` และไม่มีทางเก็บกวาดไฟล์ค้าง** (PLAN R7 ยังไม่ถูกรับมือ) |

### ❌ ยังไม่ได้ทำเลย (9)

`InstructorProfile` (ข้อมูลบัญชีธนาคารของผู้สอน) · `Section` · `CartItem` · `Order` · `OrderItem` ·
`Certificate` · `PayoutRequest` · `Review` · `Notification` · `PlatformSetting` · `AuditLog`

> ผลกระทบที่ต้องรู้: **ไม่มี `InstructorProfile` = ยังไม่มีที่เก็บเลขบัญชีธนาคาร** ซึ่งเป็นเงื่อนไขบังคับของการถอนเงิน
> ต้อง migrate ทั้ง `InstructorProfile` และ `PayoutRequest` พร้อมกันเมื่อลงมือทำเฟส 7 ส่วนที่เหลือ

---

## 1.2 API endpoints (PLAN.md หัวข้อ 2)

### ✅ ทำครบแล้ว

| กลุ่ม | endpoint |
|---|---|
| auth | `POST /auth/register` `POST /auth/login` `POST /auth/refresh` `POST /auth/logout` `GET /auth/me` `POST /auth/forgot-password` `POST /auth/reset-password` |
| users | `PATCH /users/me` `PATCH /users/me/password` |
| categories | `GET /categories` · `GET/POST/PATCH/DELETE /admin/categories[/:id]` |
| catalog | `GET /courses` (ค้นหา + กรองหมวด/ราคา/ฟรี + 4 sort) · `GET /courses/:id` |
| instructor | `GET /courses/mine` `GET /courses/mine/stats` `POST /courses` `PATCH /courses/:id` `DELETE /courses/:id` `POST /courses/:id/submit` |
| บทเรียน | `GET/POST /courses/:courseId/lessons` `PATCH /courses/:courseId/lessons/reorder` `PATCH/DELETE /lessons/:id` |
| สื่อ | `POST /uploads/presign` `GET /uploads/signed-url/*key` `GET /lessons/:id/stream` (Range + ตรวจสิทธิ์) `POST /lessons/:lessonId/materials` `DELETE /materials/:id` |
| wallet | `GET /wallet` (ยอด + รายการเดินบัญชี แบ่งหน้า) |
| เติมเงิน | `POST /topups/quote` `POST /topups` `GET /topups/mine` |
| การเรียน | `GET /learn/:courseId` `GET /learn/:courseId/lessons/:lessonId` `PATCH /progress/:lessonId` `POST /progress/:lessonId/complete` `GET /enrollments/mine` |
| แบบทดสอบ | `POST /lessons/:id/quiz` `PATCH/DELETE /quizzes/:id` `GET /quizzes/:id/take` `POST /quizzes/:id/submit` `GET /quizzes/:id/attempts/mine` |
| ถาม-ตอบ | ครบทั้ง 7 เส้นทาง (`GET/POST /courses/:id/qna` `GET /qna/:threadId` `POST .../replies` `PATCH .../resolve` `DELETE /qna/:threadId` `GET /instructor/qna/pending`) |
| admin | `GET /admin/topups` `PATCH /admin/topups/:id/approve|reject` · `GET /admin/courses/pending` `PATCH /admin/courses/:id/approve|reject` · `GET /admin/users` `PATCH /admin/users/:id/status` `PATCH /admin/users/:id/commission` |
| รายงาน | `GET /admin/reports/overview|sales-daily|top-courses|top-instructors` · `GET /instructor/reports/overview` |

### ⚠️ ทำบางส่วน / ทำต่างจากสเปก

| PLAN | สถานะจริง | ขาดอะไร |
|---|---|---|
| `GET /courses/:slug` | ใช้ **`:id`** (cuid) ไม่ใช่ slug | ไม่มีคอลัมน์ `slug` บน Course · URL สาธารณะเป็น cuid อ่านไม่รู้เรื่องและ SEO ไม่ได้ |
| `GET /courses/:slug/curriculum` | รวมอยู่ใน `GET /courses/:id` แล้ว (`lessons[]` + `isPreview` + `durationSec`) | ไม่เสียหาย ถือว่าเทียบเท่า |
| `GET /courses` ตัวกรอง | ขาด `level` และ `minRating` | ทั้งสองไม่มีคอลัมน์รองรับใน schema |
| `GET/POST /wallet/topups` | ย้ายไป `POST /topups` + `GET /topups/mine` | **ไม่มี `GET /topups/:id` รายตัว** และ **ไม่มี `POST .../cancel`** — ผู้ใช้ยกเลิกคำขอที่ยิงผิดเองไม่ได้ ต้องรอ ADMIN ปฏิเสธ |
| `POST /wallet/topups/:id/slip` | สลิปแนบมาพร้อม `POST /topups` เลย | ไม่มีสถานะ `AWAITING_SLIP` (enum มีแค่ PENDING/APPROVED/REJECTED) ยอมรับได้ |
| `GET /admin/topups/:id` | ไม่มีรายตัว — list ส่ง signed URL ของสลิปมาด้วย | หน้าจอใช้ modal จึงพอ แต่ไม่มี "ประวัติผู้ใช้ประกอบการตัดสิน" ตามที่ PLAN และ R5 ระบุ |
| `GET /admin/users/:id` | ไม่มีรายตัว | หน้า `/admin/users/[id]` จึงทำไม่ได้ |
| `GET /instructor/sales` · `/earnings` | มี `GET /instructor/reports/overview` ตัวเดียว | ไม่มี **ยอดขายรายรายการ** และไม่มี **ยอดถอนได้ / ยอดถอนแล้ว** (ยังไม่มีการถอนเงิน) |
| `GET /admin/reports/sales` | แยกเป็น `sales-daily` + `top-courses` + `top-instructors` | ไม่มีการกรองตามหมวดหมู่ · **ไม่มีส่งออก CSV** |
| แบบทดสอบฝั่งผู้เรียน | `POST /quizzes/:id/submit` ส่งทีเดียวจบ | ไม่มี `POST /quizzes/:id/attempts` (เริ่ม attempt) · ไม่มี `PATCH /attempts/:id/answers` (บันทึกระหว่างทำ) · ไม่มี `GET /attempts/:id` แยก — **เป็นการตัดสินใจโดยตั้งใจ** (CLAUDE §8) ไม่ใช่ของค้าง |
| `PATCH /qna/:threadId/status` | ชื่อจริง `/resolve` รับ `{ isResolved }` | เทียบเท่า |

### ❌ ยังไม่ได้ทำเลย

| กลุ่ม | endpoint ที่หายทั้งหมด |
|---|---|
| **ยืนยันอีเมล** | `POST /auth/verify-email` · `POST /auth/resend-verification` |
| **โปรไฟล์** | `PATCH /users/me/avatar` · `GET/PATCH /users/me/instructor-profile` (รวมข้อมูลบัญชีธนาคาร) |
| **สาธารณะ** | `GET /instructors/:id` · `GET /courses/:id/reviews` · `GET /certificates/:code` |
| **คอร์ส** | `POST /instructor/courses/:id/unpublish` · Section CRUD ทั้งหมด · `GET /instructor/courses/:id/students` · `POST/PATCH/DELETE /instructor/quizzes/:id/questions` (แก้รายข้อ) |
| **สื่อ** | `POST /media/:id/complete` (ยืนยันอัปโหลดสำเร็จ) |
| **ตะกร้า/คำสั่งซื้อ** | `GET /cart` · `POST /cart/items` · `DELETE /cart/items/:courseId` · `DELETE /cart` · `POST /orders/checkout` · `GET /orders` · `GET /orders/:id` |
| **ใบประกาศ** | `GET /me/enrollments/:courseId/certificate` |
| **รีวิว** | `POST /courses/:id/reviews` · `PATCH/DELETE /reviews/:id` · `PATCH /admin/reviews/:id/status` |
| **ถอนเงิน** | `GET/POST /instructor/payouts` · `GET /instructor/payouts/:id` · `GET /admin/payouts` · `POST /admin/payouts/:id/approve|reject` |
| **ระบบ** | `GET/PATCH /admin/settings` · `GET /admin/audit-logs` · **`GET /admin/reports/ledger` (งบทดลอง)** |
| **แจ้งเตือน** | `GET /notifications` · `POST /notifications/:id/read` · `POST /notifications/read-all` |

---

## 1.3 หน้าจอ frontend (PLAN.md หัวข้อ 3 ระบุ ~50 หน้า · มีจริง 29 route)

### ✅ ทำครบแล้ว (20)

`/` · `/courses` · `/courses/[id]` · `/login` · `/register` · `/forgot-password` · `/reset-password` ·
`/my-courses` · `/learn/[courseId]` (ทางผ่าน) · `/learn/[courseId]/[lessonId]` ·
`/learn/[courseId]/quiz/[quizId]` · `/learn/[courseId]/quiz/[quizId]/result` ·
`/learn/[courseId]/qna` · `/learn/[courseId]/qna/[threadId]` · `/wallet` ·
`/instructor` · `/instructor/courses/new` · `/instructor/courses/[id]` (แท็บข้อมูล + หลักสูตร) · `/instructor/qna` ·
`/admin` · `/admin/topups` · `/admin/courses` · `/admin/users` · `/admin/categories` · `/admin/reports`

### ⚠️ ทำบางส่วน

| PLAN | สถานะจริง |
|---|---|
| `/` หน้าแรก | เป็น **hero + จุดขาย 3 ข้อ + ปุ่มไปแคตตาล็อก** เท่านั้น · **ยังไม่มีคอร์สแนะนำ หมวดหมู่ และคอร์สขายดี** ตามที่ PLAN ระบุ (มีคอมเมนต์กำกับว่ารอเฟสถัดไป) |
| `/wallet/topup` + `/wallet/topup/[id]` | รวมเป็นหน้าเดียว `/wallet/topup` (สร้าง QR + แนบสลิป + ตารางประวัติในหน้าเดียว) — ใช้งานได้ครบ แต่ **ไม่มี URL ถาวรของคำขอหนึ่งใบให้กลับมาดู** |
| `/settings/profile` + `/settings/security` | รวมเป็น `/profile` หน้าเดียว (ข้อมูลบัญชี + แก้โปรไฟล์ + เปลี่ยนรหัสผ่าน) ครบทั้งสามบทบาท |
| `/instructor/sales` + `/instructor/earnings` | รวมเป็น `/instructor/reports` · **ไม่มียอดถอนได้ ไม่มีรายการขายรายตัว** |
| `/admin/topups/[id]` `/admin/courses/[id]` `/admin/users/[id]` | ไม่มีหน้าแยก ใช้ **modal `<dialog>` ในหน้า list** แทนทั้งสามคิว — ใช้งานได้ แต่แชร์ลิงก์งานหนึ่งใบให้เพื่อนร่วมงานไม่ได้ |
| `/instructor/courses/[id]/curriculum` | เป็น **แท็บ** ในหน้า `/instructor/courses/[id]` ไม่ใช่ route แยก |

> **หมายเหตุ: `/instructor/courses` (หน้ารายการคอร์ส) ไม่มี `page.tsx` → เข้าตรงจะได้ 404**
> ตรวจแล้วว่า**ไม่มีลิงก์ไหนในระบบชี้ไปที่ URL นี้** (sidebar ชี้ไป `/instructor` ซึ่งทำหน้าที่เป็นรายการคอร์สอยู่แล้ว)
> จึงเป็นแค่ URL ที่เดาแล้วตาย ไม่ใช่ลิงก์เสีย

### ❌ ยังไม่ได้ทำเลย (17 หน้า)

| กลุ่ม | หน้า |
|---|---|
| public | `/categories/[slug]` · `/instructors/[id]` · `/certificates/[code]` · `/about` · `/terms` · `/privacy` |
| auth | `/verify-email` |
| student | `/dashboard` · `/cart` · `/checkout` · `/orders` · `/orders/[id]` · `/learn/[courseId]/certificate` · `/notifications` |
| instructor | `/instructor/courses/[id]/quizzes` และ `/[quizId]` · `/instructor/courses/[id]/students` · `/instructor/payouts` · `/instructor/payouts/new` · `/instructor/settings` (ข้อมูลบัญชีธนาคาร) |
| admin | `/admin/payouts` · `/admin/payouts/[id]` · `/admin/reviews` · `/admin/settings` · `/admin/audit-logs` |

**ตรวจลิงก์เสียแล้ว: ไม่มี** — `href` ทั้ง 17 ค่าคงที่ และ 22 ค่าที่สร้างจาก template literal ชี้ไป route ที่มีอยู่จริงทั้งหมด

---

# เรื่องที่ 2 — error ทั้งระบบ

## 2.1 ผลการรันอัตโนมัติ

```
pnpm build   ✅ exit 0   backend (nest build) + frontend (next build --turbopack) + @getownly/shared
pnpm lint    ✅ exit 0   eslint ทั้งสองฝั่ง ไม่มี error ไม่มี warning
pnpm test    ✅ 252/252  16 ไฟล์ · PostgreSQL จริงบน :5433 · 126.98s
```

รายละเอียดเทสต์: `auth.e2e` 28 · `topups` 23 · `wallet` 22 · `qna` 21 · `courses` 21 · `quizzes` 20 ·
`learn` 19 · `reports` 18 · `lessons` 18 · `users` 15 · `ledger` 11 · `uploads` 11 · `course-review` 9 ·
`categories` 8 · `enrollments` 4 · `roles.guard` 4

## 2.2 ปัญหาที่พบจากการไล่อ่านโค้ด

---

### 🔴 CRITICAL — ต้องแก้ก่อนสอบ

#### C-1 · ไม่มี error boundary เลยทั้งระบบ

ทั้งโปรเจกต์มีแค่ `frontend/src/app/(public)/courses/[id]/not-found.tsx` ไฟล์เดียว
**ไม่มี `error.tsx` · ไม่มี `global-error.tsx` · ไม่มี `not-found.tsx` ที่ root**

ผลจริง:
- error ที่ throw ใน Server Component (เช่น `/courses` ถ้า `serverFetch` เจอ JSON พัง) → ผู้ใช้เห็น
  **"Application error: a server-side exception has occurred"** เป็นภาษาอังกฤษ
- เข้า URL ที่ไม่มีอยู่ (เช่น `/instructor/courses`) → หน้า 404 มาตรฐานของ Next **"This page could not be found"** ภาษาอังกฤษ

**ขัดข้อห้าม 19 ตรงๆ** และขัดเกณฑ์ตรวจรับเฟส 8 ที่เขียนว่า "หน้า 404/500"
เกณฑ์ข้อ "ทุกหน้ามี empty state ไม่มีหน้าจอขาวเปล่า" ถูกติ๊ก [x] ไว้ ซึ่งจริงเฉพาะภายในหน้าที่ render สำเร็จ

**สิ่งที่ต้องเพิ่ม:** `app/error.tsx` · `app/global-error.tsx` · `app/not-found.tsx` และควรมี `error.tsx` ประจำ route group ที่หนักที่สุด (`(admin)` `(student)`)

#### C-2 · session หมดอายุจริงแล้วผู้ใช้ติดอยู่กับหน้า error ไม่ถูกพาไป login

`apiRequest` ใน [api-client.ts:112](frontend/src/lib/api-client.ts#L112) หมุน refresh หนึ่งครั้งเมื่อเจอ 401
ถ้าหมุนไม่สำเร็จ มัน `throw new ApiError({statusCode: 401})` แล้ว **จบแค่นั้น**
ไล่ทั้ง `frontend/src` แล้ว **ไม่มีที่ไหนอ่าน `statusCode === 401` เพื่อ redirect ไป `/login` เลยแม้แต่จุดเดียว**

กรณีที่เกิดจริงและเกิดบ่อย:
1. refresh token หมดอายุ 7 วัน (คุกกี้ยังอยู่ในเบราว์เซอร์)
2. session ถูก revoke เพราะตรวจพบการใช้ refresh token ซ้ำ
3. **เปลี่ยนรหัสผ่านจากอีกอุปกรณ์** — `passwordChangedAt` ทำให้ token เดิมตายทันที

ทั้งสามกรณี **คุกกี้ยังมีอยู่** `middleware.ts` จึงตัดสินว่า `hasSession = true` และปล่อยผ่าน
ผู้ใช้ได้หน้า `/my-courses` หรือ `/admin/topups` ที่ขึ้น error state ภาษาไทยค้างอยู่ กด "ลองใหม่" กี่ครั้งก็ได้ผลเดิม
**ไม่มีอะไรบอกให้เขารู้ว่าต้องล็อกอินใหม่ และไม่มีปุ่มไปหน้า login**

**สิ่งที่ต้องเพิ่ม:** ใน `apiRequest` เมื่อ refresh ล้มเหลวบน 401 → เคลียร์คุกกี้ + `window.location.assign("/login?next=...")`
(ทำที่ api-client ที่เดียว จะได้ผลกับทุกหน้าพร้อมกัน)

---

### 🟠 IMPORTANT — กระทบการนำเสนอหรือความถูกต้องของสเปก

#### I-1 · ไม่มีหน้างบทดลอง (`GET /admin/reports/ledger`)

PLAN.md หัวข้อ 6 เขียนไว้ชัดว่า **"หน้างบทดลองห้ามตัด เพราะเป็นหลักฐานว่าระบบบัญชีคู่ทำงานจริง"**
ปัจจุบันความสมดุลพิสูจน์ได้แค่ในเทสต์ (`assertLedgerInvariants`) และใน `demo-seed.ts`
**กรรมการเปิดเว็บดูเองไม่ได้** ซึ่งเป็นหัวใจของหัวข้อปริญญานิพนธ์นี้

#### I-2 · แก้ราคาคอร์สที่เผยแพร่แล้วไม่ต้องส่งอนุมัติใหม่

PLAN.md §1.2 บรรทัดที่ 66: *"แก้เนื้อหาคอร์สที่ PUBLISHED ได้ทันที แต่ **แก้ราคาต้องส่งอนุมัติใหม่**"*
โค้ดจริงที่ [courses.service.ts:272](backend/src/modules/courses/courses.service.ts#L272) เขียนราคาใหม่ทับได้ทุกสถานะยกเว้น `PENDING_REVIEW`
ผู้สอนจึงตั้งราคา 99 บาทให้ผ่านอนุมัติ แล้วแก้เป็น 9,900 บาททันทีหลังเผยแพร่ได้ โดยไม่มีใครเห็น

#### I-3 · ไม่มีสถานะ `UNPUBLISHED` และไม่มี endpoint `unpublish`

`enum CourseStatus` มีแค่ `DRAFT | PENDING_REVIEW | PUBLISHED | REJECTED`
PLAN §1.2 กำหนดว่า *"คอร์สที่มีคนซื้อแล้วห้ามลบ ทำได้แค่ UNPUBLISHED"*
ผลจริง: **คอร์สที่เผยแพร่แล้วและมีคนซื้อ ถอดออกจากแคตตาล็อกไม่ได้เลย** ลบก็ไม่ได้ (ต้องเป็น DRAFT + ไม่มี enrollment)
ถ้าเนื้อหามีปัญหาหลังขายไปแล้ว ระบบไม่มีทางออกให้ทั้งผู้สอนและ ADMIN

#### I-4 · ไม่มี `helmet` และไม่มีการจำกัดขนาด payload

เกณฑ์เฟส 8 ระบุ *"helmet · CORS เข้มงวด · จำกัดขนาด payload"*
[app.setup.ts](backend/src/app.setup.ts) มี CORS เข้มงวด ✅ · ValidationPipe เข้ม ✅ · rate limit ✅
แต่ **ไม่มี `helmet`** (ไม่อยู่ใน `backend/package.json` เลย) และ **ไม่มี `bodyParser` limit**
ไม่มี `X-Content-Type-Options` `X-Frame-Options` `Strict-Transport-Security` ออกจาก API

#### I-5 · `packages/shared` ไม่ถูก import จากที่ไหนเลย

`grep "@getownly/shared"` ใน `backend/src` และ `frontend/src` → **ศูนย์ผลลัพธ์**
แพ็กเกจถูก build ทุกครั้งที่ `pnpm build` แต่ไม่มีใครใช้ · ทั้ง FE และ BE ประกาศ type ของตัวเองซ้ำกัน
(`frontend/src/lib/*/types.ts` กับ `backend/src/modules/*/dto/*-response.dto.ts`)
เป็นเหตุผลหลักข้อหนึ่งที่ CLAUDE.md ยกมาว่าทำไมถึงเลือก pnpm workspace — ตอนนี้ยังไม่เป็นจริง

#### I-6 · `next.config.ts` hardcode `localhost:9000`

```ts
remotePatterns: [{ protocol: "http", hostname: "localhost", port: "9000", ... }]
```
มีคอมเมนต์กำกับว่าต้องแก้พร้อม `MINIO_ENDPOINT` แต่ยังเป็นค่าตายตัวที่ไม่ผูกกับ env
ย้าย MinIO เมื่อไร รูปปกทุกใบหายทันทีโดย build ไม่ error

#### I-7 · CLAUDE.md หัวข้อ 3 และ 6 บอกวิธีติดตั้งผิด

CLAUDE.md เขียนว่ามี `.env.example` ที่ **root** และให้รัน `cp .env.example .env`
**ของจริงไม่มีไฟล์นั้น** — มีแค่ `backend/.env.example` และ `frontend/.env.example`
README.md ถูกต้องแล้ว (บรรทัด 57–58) แต่ CLAUDE.md ยังค้างของเก่า
เกณฑ์ตรวจรับ "ติดตั้งจาก README บนเครื่องเปล่า" ยังไม่เคยถูกลองจริง — ข้อนี้คือหลักฐานว่าเอกสารสองฉบับยังไม่ตรงกัน

#### I-8 · ไม่มีทางยกเลิกคำขอเติมเงินที่ยิงผิด

ไม่มี `POST /topups/:id/cancel` และ `TopupStatus` ไม่มีค่า `CANCELLED`
คนกรอกยอดผิดแล้วกดส่ง ต้องรอ ADMIN กดปฏิเสธเท่านั้น และมันกินโควตา 5 รายการต่อคนไปด้วย

#### I-9 · แถบนำทางของ `(student)` และ `(instructor)` ล้นขอบที่ 375px จริง — ไม่ใช่แค่ "ยังไม่ได้ดู"

ไล่โค้ดเทียบกับความกว้าง 375px (iPhone SE/mini) แล้วพบว่าไม่ใช่แค่ข้อสงสัย แต่เป็นบั๊กที่ยืนยันได้จากคลาส Tailwind ตรงๆ:

**[`StudentNav.tsx`](frontend/src/app/(student)/StudentNav.tsx#L67-L112)** — header เดียวที่ครอบทุกหน้าของ STUDENT
```
<div className="flex h-16 ... justify-between ...">
  <Link>getownly</Link>
  <nav className="flex items-center gap-1 text-sm">   ← ไม่มี flex-wrap, ไม่มี overflow-x-auto
    "คอร์สทั้งหมด" "คอร์สของฉัน" "กระเป๋าเงิน" "โปรไฟล์ของฉัน"
  </nav>
  <div>[ยอดกระเป๋า ฿x,xxx.xx] [ออกจากระบบ]</div>
</div>
```
รวมความกว้างจริงของ 4 label ภาษาไทย + brand + ยอดกระเป๋า + ปุ่มออกจากระบบ เกิน 550px
ไม่มี `flex-wrap` และไม่มี `min-w-0`/`truncate` บน flex item ใดเลย → บนจอ 375px แถวนี้จะดันความกว้างทั้งหน้าให้เกิน viewport
เกิด **horizontal scroll ทั้งหน้า** (ไม่ใช่แค่ในกล่องเดียวแบบตารางที่มี `overflow-x-auto` รองรับไว้แล้ว) ซึ่งตรงกับสิ่งที่เกณฑ์เฟส 8 กังวลไว้เป๊ะๆ ("เนื้อหาล้นขอบ")

**[`(instructor)/layout.tsx`](frontend/src/app/(instructor)/layout.tsx#L25-L41)** — sidebar ของ INSTRUCTOR เป็นบั๊กแบบเดียวกัน
```
<nav className="flex flex-row gap-1 lg:flex-1 lg:flex-col">   ← ไม่มี flex-wrap บนมือถือเช่นกัน
```
4 ลิงก์ ("ภาพรวม" "สร้างคอร์สใหม่" "กล่องคำถาม" "รายงานยอดขาย") แต่ละอันมีทั้งไอคอนและข้อความ ต่อกันในแถวเดียวที่ไม่ห่อบรรทัด

**เทียบกับ [`AdminNav.tsx`](frontend/src/app/(admin)/AdminNav.tsx#L63)** ซึ่งทำถูกอยู่แล้ว:
```
<nav className="flex flex-row flex-wrap gap-1 lg:flex-1 lg:flex-col lg:flex-nowrap">
```
มี `flex-wrap` กำกับไว้บนมือถือ — เป็นหลักฐานว่าในโค้ดเบสเดียวกันมีทั้งแบบที่ทำถูกและแบบที่ลืมทำ ไม่ใช่รูปแบบที่ตั้งใจให้ต่างกัน

**สรุป:** จาก 3 แถบนำทางหลักของระบบ (`StudentNav` `InstructorLayout` `AdminNav`) มีแค่ `AdminNav` ที่รอดที่ 375px
`StudentNav` กระทบทุกหน้าที่ STUDENT ใช้งาน (`/courses` `/my-courses` `/wallet` ฯลฯ) และ `InstructorLayout` กระทบทุกหน้าของ INSTRUCTOR — **เป็นจุดที่ควรแก้ก่อนข้ออื่นในหมวด responsive เพราะกระทบทุกหน้าจอ ไม่ใช่หน้าใดหน้าหนึ่ง**

ส่วนที่ตรวจแล้วไม่พบปัญหาเพิ่มเติมในหมวดนี้: ตาราง 8 จุดมี `overflow-x-auto` ครบและกว้างพอสำหรับเนื้อหา ·
grid ของทุกหน้า (`courses` `admin` `instructor` `my-courses` `profile`) มี breakpoint `sm:`/`lg:` ที่ยุบเป็นคอลัมน์เดียวถูกต้อง ·
modal ทั้งสองแบบ (`ReviewDialog` `CommissionDialog`) ใช้ `w-[min(Xrem, Yvw)]` ที่คำนวณตาม viewport แล้ว ปลอดภัยที่ 375px ·
`CourseFilters` เป็น `flex-col` เต็มความกว้าง ไม่มีความเสี่ยง

---

### 🟡 NICE-TO-HAVE — เก็บทีหลังได้

#### N-1 · ความกว้าง Decimal ไม่ตรงกับ CLAUDE.md §5

CLAUDE §5 กำหนด `Decimal(12,2)` สำหรับเงินและ `Decimal(5,2)` สำหรับเปอร์เซ็นต์
ของจริง: `Course.price` และ `Enrollment.pricePaid` และ `TopupRequest.amount` เป็น **`Decimal(10,2)`** ·
`Account.balance` และ `LedgerEntry.amount` เป็น **`Decimal(14,2)`** · `commissionRate` เป็น **`Decimal(5,4)`**
ทุกตัวเป็น Decimal จริง ไม่มี Float หลุด (ข้อห้าม 1 ผ่าน) และไม่มีความเสี่ยง overflow ในทางปฏิบัติ
เป็นเรื่อง**เอกสารกับโค้ดไม่ตรงกัน** ที่กรรมการเปิดดูแล้วจะถาม — เลือกได้ว่าจะแก้ schema หรือแก้เอกสาร

#### N-2 · `NEXT_PUBLIC_SITE_URL` และ `NEXT_PUBLIC_SITE_NAME` ประกาศไว้แต่ไม่มีใครใช้

อยู่ใน `frontend/.env.example` แต่ `grep process.env` ในทั้ง `frontend/src` เจอแค่ `API_BASE_URL` สองตัว
เป็น config ตายที่ทำให้คนตั้งค่าเข้าใจผิดว่ามีผล

#### N-3 · URL สาธารณะเป็น cuid ไม่ใช่ slug

`/courses/cmd7x9k2h0001abcd...` — PLAN ออกแบบไว้เป็น `/courses/[slug]`
ไม่กระทบการทำงาน แต่กระทบภาพตอนสาธิตและ SEO ที่ PLAN ตั้งใจไว้

#### N-4 · ไม่มีสถานะ `PENDING/READY` ของไฟล์ → ไฟล์ค้างใน MinIO ไม่มีใครเก็บกวาด

PLAN R7 เตรียมวิธีรับมือไว้แล้ว (`MediaAsset.status` + สคริปต์เก็บกวาด 24 ชม.) แต่ยังไม่ได้ทำ
อัปโหลดวิดีโอ 400MB แล้วปิดแท็บก่อนกดบันทึก = ไฟล์อยู่ใน bucket ตลอดไป

#### N-5 · หน้าแรกยังเป็น placeholder

`(public)/page.tsx` มีคอมเมนต์เขียนไว้เองว่า *"The curated sections belong to a later phase"*
เป็นหน้าแรกที่กรรมการเห็นก่อนหน้าอื่น และ API ที่ต้องใช้ (`GET /courses?sort=popular`, `GET /categories`) มีครบแล้ว

#### N-6 · responsive 375px — ตรวจแล้วจากโค้ด (ไม่ใช่ค้างเฉยๆ อีกต่อไป)

เดิมบันทึกไว้ว่า "ยังไม่ได้ตรวจด้วยตา" รอบนี้ไล่โค้ดเทียบความกว้างจริงแล้ว พบบั๊กที่ยืนยันได้ 1 จุด
ย้ายไปเป็น **I-9** เพราะกระทบทุกหน้าของ STUDENT และ INSTRUCTOR ไม่ใช่แค่รายละเอียดเล็กๆ
ที่เหลือ (ตาราง 8 จุด · grid ทุกหน้า · modal 2 แบบ · filter sidebar) ตรวจแล้วไม่พบปัญหา รายละเอียดอยู่ในข้อ I-9
**ยังมีข้อจำกัดอยู่: นี่คือการอ่านโค้ดเทียบตัวเลข ไม่ใช่การเปิดเบราว์เซอร์จริงที่ 375px** — สิ่งที่โค้ดอ่านแล้วดูปลอดภัย
(เช่นความกว้างของฟอนต์ไทยจริงบนหน้าจอ, การพันบรรทัดของ `<select>` ของเบราว์เซอร์แต่ละตัว) ควรเปิดดูจริงอีกรอบก่อนสอบ

---

## 2.3 สิ่งที่ตรวจแล้วและ **ไม่พบปัญหา** (บันทึกไว้เพื่อไม่ต้องตรวจซ้ำ)

| ที่ตรวจ | ผล |
|---|---|
| `fetch` ที่ไม่มี error handling | **ไม่พบ** — ทุกเส้นทางผ่าน `apiRequest` หรือ `serverFetch` ซึ่งมี try/catch ครบ และแปลงเป็น `ApiError` / `{data: null}` เสมอ |
| `catch` ที่กลืน error เงียบๆ | **ไม่พบที่ผิด** — มี 8 จุด ทุกจุดมีคอมเมนต์อธิบายว่าทำไมเงียบถึงถูก (บันทึกตำแหน่งวิดีโอ · คลิปบอร์ด · ตัวเลือกบทเรียนที่ไม่บังคับ) |
| `useEffect` ที่ไม่มี cleanup | **ไม่พบที่ผิด** — ตัวเดียวที่มี timer คือ `LessonPlayer` และมี `clearInterval` + flush ตอน unmount ครบ |
| ปุ่มที่ไม่มี loading state | **ไม่พบ** — ไล่ 60 จุด ทุกปุ่มที่ยิง API มี `disabled={saving/busy/submitting/isSubmitting}` |
| ข้อความ error ภาษาอังกฤษหลุด | **ไม่พบในโค้ดที่เขียนเอง** — ทุกข้อความมาจาก `lib/messages/*.ts` (7 ไฟล์) · ที่หลุดคือหน้า error/404 ของ Next เอง (ดู C-1) |
| hardcode URL | **ไม่พบ** ยกเว้น `next.config.ts` (I-6) · `localhost:4000` ในโค้ดเป็น fallback ของ env ที่ตั้งใจ |
| hardcode สี | **ไม่พบนอกที่อนุญาต** — มีเฉพาะ `lib/chart-theme.ts` และ template อีเมล ตามที่ CLAUDE.md อนุญาตไว้ 2 จุด |
| `console.log` ค้าง | **ไม่พบในโค้ดแอป** — มีเฉพาะ seed scripts และบรรทัด boot ของ `main.ts` |
| `TODO` / `FIXME` / `@ts-ignore` | **ไม่พบเลย** ใน `backend/src` `frontend/src` `packages/` |
| `eslint-disable` | 4 จุด ทั้งหมดเป็น `no-img-element` พร้อมเหตุผลกำกับ (QR data URI และสลิป signed URL) |
| ลิงก์เสีย | **ไม่พบ** — `href` ทั้ง 39 ค่าชี้ไป route ที่มีจริง |
| endpoint ที่ลืม `@Roles` / `@Public` | **ไม่พบ** — `JwtAuthGuard` เป็น APP_GUARD ทุก route ต้องล็อกอินโดยปริยาย · `@Public()` ประกาศไว้ 8 จุดอย่างจงใจ |

---

# 3. ลำดับที่แนะนำให้ทำต่อ

| ลำดับ | งาน | เหตุผล | แรง |
|---|---|---|---|
| 1 | **C-1** เพิ่ม `error.tsx` `global-error.tsx` `not-found.tsx` | ข้อความอังกฤษบนหน้าจอ = ขัดข้อห้าม 19 และเห็นได้ทันทีตอนสาธิต | เล็ก (~1 ชม.) |
| 2 | **C-2** redirect ไป `/login` เมื่อ refresh ล้มเหลว | แก้ที่ `api-client.ts` จุดเดียว ได้ผลทั้งระบบ | เล็ก (~1 ชม.) |
| 3 | **I-1** หน้างบทดลอง `/admin/reports/ledger` | PLAN บอกเองว่าห้ามตัด · เป็นหลักฐานชิ้นเอกของหัวข้อ | กลาง |
| 4 | **I-4** ใส่ helmet + payload limit | เกณฑ์เฟส 8 · เพิ่ม 3 บรรทัดใน `app.setup.ts` | เล็ก |
| 5 | **I-9** เพิ่ม `flex-wrap` ให้ `StudentNav` และ `InstructorLayout` (ตาม `AdminNav` ที่ทำถูกแล้ว) | ล้นขอบทุกหน้าของ STUDENT/INSTRUCTOR บนมือถือ ยืนยันจากโค้ดแล้วไม่ใช่ข้อสงสัย | เล็ก (~30 นาที ใช้แพตเทิร์นที่มีอยู่แล้ว) |
| 6 | **I-7** แก้ CLAUDE.md ให้ตรงกับ README | เอกสารขัดกันเองคือสิ่งที่กรรมการจับได้ง่ายที่สุด | เล็ก |
| 7 | ตะกร้า + Order/OrderItem + `/cart` `/checkout` `/orders` | เฟส 5 ที่ค้าง · PLAN §6 บอกว่าเฟส 1–5 ห้ามตัด | ใหญ่ |
| 8 | การถอนเงิน (`InstructorProfile` + `PayoutRequest` + `TxType.PAYOUT`) | PLAN §6 บอกว่า "ควรเหลือไว้" · ปิดวงจรเงินให้ครบ | ใหญ่ |
| 9 | รีวิว + ให้ดาว | PLAN §6 บอกว่า "ควรเหลือไว้" · ปลดล็อกตัวกรอง `minRating` ด้วย | กลาง |
| 10 | **I-2 / I-3** กติกาแก้ราคา + สถานะ UNPUBLISHED | เป็นกติกาธุรกิจที่เขียนไว้ในเล่มแล้วแต่โค้ดยังไม่บังคับ | กลาง |
| 11 | ใบประกาศนียบัตร · หน้าจอสร้างข้อสอบ · หน้าแรกจริง (N-5) | PLAN §6 จัดให้ตัดได้ ทำถ้าเวลาเหลือ | ใหญ่ |

---

**รอคำสั่งต่อไป — ยังไม่ได้แก้อะไรทั้งสิ้น**
