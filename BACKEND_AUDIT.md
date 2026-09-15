# BACKEND_AUDIT.md — ตรวจสอบ backend เทียบกับ PLAN.md

**วันที่ตรวจ:** 2026-08-19
**ขอบเขต:** `backend/src/**` เทียบกับ PLAN.md §1 (entity), §2 (API endpoints) และ CLAUDE.md §8 (decision log)
**สถานะโดยรวม:** backend ครอบคลุมเฟส 1–6 และบางส่วนของเฟส 7–8 ตรงกับที่ CLAUDE.md บันทึกไว้ ไม่พบความเบี่ยงเบนที่ CLAUDE.md ไม่ได้บันทึกไว้ในจุดใหญ่ๆ ยกเว้นบางจุดที่ระบุไว้ด้านล่าง (เช่น `Course` ไม่มี `slug`, ไม่มี `GET /instructors/:id`, rate limit ไม่ครอบคลุม endpoint เติมเงิน/อัปโหลดตามที่ PLAN.md เฟส 8 ตั้งเป้าไว้) รายละเอียดอยู่ในแต่ละหัวข้อ

> หมายเหตุการอ่านตาราง: "หมายเหตุ" อ้างอิง `path:line` เสมอ ถ้าไม่พบให้เขียนว่า "grep ไม่เจอ" หรือ "ไม่พบ" อย่างชัดเจน

---

## 1. Entity coverage (เทียบ PLAN.md §1 กับ `backend/prisma/schema.prisma`)

ไฟล์ที่ตรวจ: `backend/prisma/schema.prisma` (484 บรรทัด)

| Entity (PLAN.md) | สถานะ | หมายเหตุ |
|---|---|---|
| User | ทำครบแล้ว (ต่างชื่อฟิลด์บางส่วน) | `schema.prisma:72-115` มีครบ email/username/passwordHash/role/status/displayName/avatarKey/createdAt · เพิ่ม `commissionRate Decimal(5,4)` (บรรทัด 91) แทน InstructorProfile แยก ตามที่บันทึกใน CLAUDE.md §8 · มี `passwordChangedAt` (บรรทัด 97) ที่ไม่ได้อยู่ใน PLAN.md แต่ CLAUDE.md อธิบายเหตุผลไว้แล้ว · **ไม่มี `emailVerifiedAt`** เลย (ไม่มี field ใดๆ เกี่ยวกับ email verification) — ตรงกับที่ PLAN.md เฟส 2 บันทึกว่า "ยังไม่ได้ทำ" |
| InstructorProfile | ไม่ทำ (ตั้งใจ, มีบันทึกใน CLAUDE.md) | ไม่มี model นี้ ใช้ `User.commissionRate` แทน (`schema.prisma:91`) — **แต่ bankName/bankAccountNo/bankAccountName/headline/bio ก็หายไปด้วย** บางส่วน (`bio`,`expertise` ยังอยู่บน User `schema.prisma:85-86` แต่ไม่มีข้อมูลบัญชีธนาคาร) เพราะ PayoutRequest ยังไม่ทำ (เฟส 7) |
| RefreshToken | ทำครบแล้ว | `schema.prisma:117-129` มี tokenHash unique, expiresAt, revokedAt ตรงสเปก (ไม่มี `replacedById`/`userAgent`/`ip` แต่ไม่กระทบ logic การ rotate ที่ตรวจแล้วใน auth.service) |
| AuthToken | ทำบางส่วน (เปลี่ยนชื่อ+ตัดขอบเขต) | มี `PasswordResetToken` (`schema.prisma:131-142`) แทน แต่ **ไม่มี EMAIL_VERIFY type เลย** เพราะไม่มี email verification flow ทั้งระบบ (ตรงกับ PLAN.md เฟส 2 ที่บันทึกไว้ว่ายังไม่ทำ) |
| Category | ทำครบแล้ว | `schema.prisma:148-155` มี name(unique), slug(unique) แต่ **ไม่มี `sortOrder`, `isActive`** — หมวดหมู่ทั้งหมดถือว่า active เสมอ ไม่มีการเรียงลำดับเอง (เรียงตามที่ query ส่งมา) ไม่ได้บันทึกไว้ใน CLAUDE.md §8 ว่าตัดทิ้งตั้งใจ — เป็นช่องว่างที่ไม่ได้บันทึกเหตุผล |
| Course | ทำบางส่วน | `schema.prisma:157-187` มี instructorId/categoryId/title/description/coverKey(=thumbnailKey)/price/status/rejectReason/publishedAt ครบตามแนวคิด แต่ **ไม่มี `slug`** เลย (endpoint จริงใช้ `:id` ไม่ใช่ `:slug` — ดูหัวข้อ endpoint) **ไม่มี `subtitle`, `level`, `submittedAt`, `approvedAt`, `approvedById`, `ratingAvg`, `ratingCount`, `enrollmentCount`** — level ถูกบันทึกว่าตัดแล้วในเฟส 3 (CLAUDE.md) แต่ `slug`/`ratingAvg`/`ratingCount`/`enrollmentCount`/`approvedById` ไม่มีการบันทึกเหตุผลใน CLAUDE.md §8 ชัดเจน (ratingAvg/ratingCount ขาดเพราะไม่มี Review model ยังพอเข้าใจได้ แต่ enrollmentCount ที่หายไปทำให้ต้อง COUNT สดทุกครั้ง) |
| Section | ไม่ทำ (ตั้งใจ, บันทึกในเฟส 1) | ไม่มี model `Section` — `Lesson` ผูกกับ `Course` ตรงๆ ด้วย `orderIndex` (`schema.prisma:189-210`) ไม่มีชั้นบท (section) คั่นกลาง ตรงกับที่ CLAUDE.md §8 หัวข้อ "สิ่งที่ตัดสินใจเพิ่มระหว่างเฟส 1" บอกว่าโครงสร้างจริงกระชับกว่า |
| Lesson | ทำบางส่วน | `schema.prisma:189-210` มี title/orderIndex/videoKey/durationSec/isPreview ตรงสเปกส่วนใหญ่ แต่ **ไม่มี `type` (VIDEO/DOCUMENT/TEXT)** — ทุกบทเรียนถือว่าเป็นวิดีโอเสมอ (มี `contentText` ก็ไม่มี) ไม่ได้บันทึกเหตุผลใน CLAUDE.md §8 |
| LessonAttachment | ไม่ทำแยก (รวมเป็น Material) | `Material` model (`schema.prisma:212-228`) ทำหน้าที่แทน ผูกกับ Lesson ตรงๆ ไม่ผ่าน MediaAsset กลาง |
| MediaAsset | ไม่ทำ (ตั้งใจโดยนัย) | ไม่มี model กลางสำหรับ media — แต่ละ entity (`User.avatarKey`, `Course.coverKey`, `Lesson.videoKey`, `Material.fileKey`, `TopupRequest.slipKey`) เก็บ object key ของตัวเองตรงๆ ไม่มี status PENDING/READY ระดับ DB — CLAUDE.md §8 ไม่ได้พูดถึงการตัด MediaAsset ตรงๆ (เป็นช่องว่างเอกสาร ไม่ใช่บั๊ก เพราะโค้ดทำงานได้แบบไม่มี MediaAsset จริง) |
| Quiz | ทำบางส่วน | `schema.prisma:234-248` ผูกกับ `Lesson` (unique lessonId) ไม่ใช่ `Course`+`sectionId` ตามที่ PLAN.md เขียน — ตรงกับ CLAUDE.md §8 ("Quiz ผูกกับ Lesson ไม่ใช่ Course") **ไม่มี `maxAttempts`, `timeLimitMinutes`, `isRequiredForCompletion`, `isPublished`** — ตรงกับที่ CLAUDE.md บันทึกว่าตั้งใจไม่ทำโควตา/จับเวลา |
| QuizQuestion | ทำบางส่วน | `schema.prisma:250-262` มี questionText/orderIndex/choices แต่ **ไม่มี `type` (SINGLE/MULTIPLE/TRUE_FALSE), `points`, `explanation`** — ทุกข้อเป็น single-choice โดยปริยาย (มีตัวเลือกถูก 1 ตัวเท่านั้นต่อข้อ ตรวจใน service) |
| QuizChoice | ทำครบแล้ว | `schema.prisma:264-277` มี choiceText, isCorrect, orderIndex ครบ |
| QuizAttempt | ทำบางส่วน | `schema.prisma:279-295` มี score(Int, ไม่ใช่ Decimal(5,2) ตาม PLAN.md), passed, attemptedAt แต่ **ไม่มี `attemptNo`, `startedAt`, `submittedAt`, `earnedPoints`, `totalPoints`, `status`** — ไม่มีแนวคิด IN_PROGRESS/บันทึกคำตอบระหว่างทำ (`PATCH /attempts/:id/answers` ใน PLAN.md ไม่มีจริง) ตรงกับ CLAUDE.md ที่บอกว่าไม่มี maxAttempts/timeLimit และ "ทำซ้ำได้ไม่จำกัด" |
| QuizAnswer | ทำบางส่วน (เปลี่ยนชื่อ) | `QuizAttemptAnswer` (`schema.prisma:297-308`) เก็บ `choiceId` เดี่ยว ไม่ใช่ `selectedChoiceIds: String[]` — ตรงกับ decision "ตอบได้หนึ่งคำตอบต่อหนึ่งข้อพอดี" ไม่รองรับ MULTIPLE_CHOICE จริง แม้ PLAN.md ตั้งใจให้รองรับ |
| CartItem | ไม่ทำ (ตั้งใจ, บันทึกในเฟส 5) | ไม่มี model — ไม่มีตะกร้าเลย |
| Order / OrderItem | ไม่ทำ (ตั้งใจ, บันทึกในเฟส 5) | ไม่มี model — `Enrollment` เก็บ snapshot เอง (`pricePaid`, `commissionRateSnapshot` — `schema.prisma:319-322`) |
| Enrollment | ทำบางส่วน | `schema.prisma:314-332` มี courseId/studentId/pricePaid/commissionRateSnapshot/enrolledAt/unique(courseId,studentId) ครบตามแนวคิด snapshot แต่ **ไม่มี `lastAccessedAt`, `progressPercent`, `completedAt`** ที่ระดับ DB — progress ต้องคำนวณสดจาก `LessonProgress` ทุกครั้ง (ดูหัวข้อ endpoint `/learn`) |
| LessonProgress | ทำบางส่วน | `schema.prisma:334-348` มี `lastPositionSec`, `completedAt`, unique(enrollmentId,lessonId) แต่ **ไม่มี `watchedSeconds`, `isCompleted`** (`isCompleted` แทนที่ด้วย `completedAt != null` ซึ่งสมเหตุสมผล) |
| Certificate | ไม่ทำ (ตั้งใจ, บันทึกในเฟส 6/7) | ไม่มี model เลย — endpoint `/certificates/:code`, `/me/enrollments/:courseId/certificate` ไม่มีจริง |
| Wallet | ไม่ทำแยก (ตั้งใจ) | ใช้ `Account` kind=`USER_WALLET` แทน (`schema.prisma:430-443`) ตรงกับ CLAUDE.md §8 |
| LedgerAccount | ทำบางส่วน (เปลี่ยนชื่อ+ตัดผังบัญชี) | `Account` model — มี `AccountKind`: `USER_WALLET` / `PLATFORM_REVENUE` / `EXTERNAL_BANK` (`schema.prisma:52-56`) **ไม่มี `PLATFORM_CASH`, `INSTRUCTOR_PAYABLE`** ตามที่ PLAN.md ผังบัญชีกำหนด — ใช้ `EXTERNAL_BANK` แทน `PLATFORM_CASH` และรายได้ผู้สอนเข้า `USER_WALLET` ของผู้สอนตรงๆ แทน `INSTRUCTOR_PAYABLE` — ตรงกับ CLAUDE.md §8 ที่บันทึกไว้ชัดเจนว่าเมื่อทำ payout ต้องเพิ่ม `TxType.PAYOUT` |
| LedgerTransaction | ทำครบแล้ว | `schema.prisma:446-467` มี idempotencyKey(unique), referenceType/referenceId(=refType/refId), createdAt — **ไม่มี `createdById`** (ไม่ทราบว่า transaction เกิดจาก admin คนไหนตรงๆ ในแถวนี้ ต้องดูจาก TopupRequest.reviewedById แทน) |
| LedgerEntry | ทำครบแล้ว | `schema.prisma:469-483` มี transactionId, accountId, direction, amount(Decimal 14,2) |
| TopUpRequest | ทำบางส่วน (เปลี่ยนชื่อ) | `TopupRequest` (`schema.prisma:396-418`) มี studentId/amount/slipKey/status/reviewedById/reviewedAt/note **ไม่มี `referenceCode`, `qrPayload`, `expiresAt`, `ledgerTransactionId` column ตรงๆ** (ledger link หาโดย `idempotencyKey = topup:<id>` แทน ตามที่ CLAUDE.md บันทึกว่า `POST /topups/quote` ไม่เขียนอะไรลง DB เลย จึงไม่ต้องมีคอลัมน์เหล่านี้) |
| PayoutRequest | ไม่ทำ (ตั้งใจ, บันทึกในเฟส 7) | ไม่มี model เลย — ไม่มี endpoint ถอนเงินใดๆ ทั้ง instructor และ admin |
| Review | ไม่ทำ (ตั้งใจ, บันทึกในเฟส 7) | ไม่มี model — ไม่มี endpoint รีวิวใดๆ |
| QnaThread | ทำบางส่วน | `schema.prisma:354-375` มี courseId/lessonId(nullable)/studentId(=userId)/title/body/isResolved(=status ที่ตัดเหลือ boolean เดียวแทน OPEN/ANSWERED/CLOSED) **ไม่มี `replyCount`, `lastReplyAt`** เป็นคอลัมน์จริง (คำนวณสดจาก relation `replies`) |
| QnaReply | ทำบางส่วน | `schema.prisma:377-390` มี threadId/userId/body/createdAt **ไม่มี `isInstructorReply`** — ตรงกับ CLAUDE.md §8 ที่บันทึกไว้ชัดเจนว่าตั้งใจไม่เก็บ คำนวณจาก `reply.userId === course.instructorId` แทน |
| Notification | ไม่ทำ (ตั้งใจ, บันทึกในเฟส 7) | ไม่มี model เลย — ไม่มีระบบแจ้งเตือนใดๆ ทั้งเว็บและอีเมล |
| PlatformSetting | ไม่ทำ และ**ไม่มีบันทึกเหตุผลใน CLAUDE.md §8** | ไม่มี model นี้เลย — grep ไม่เจอ `PlatformSetting` ในทั้ง schema และ services ค่า default เช่น commission rate ตั้งต้นถูก hardcode เป็นค่า default บน `User.commissionRate` (`schema.prisma:91` `@default(0.30)`) แทน ไม่มีที่ตั้งค่า PromptPay ID/ยอดถอนขั้นต่ำแบบ runtime — ต้องแก้ `.env` แทน (`PROMPTPAY_ID` ตาม CLAUDE.md §8) — **นี่คือช่องว่างที่ยังไม่มีเอกสารรับรอง แนะนำบันทึกเพิ่มใน CLAUDE.md** |
| AuditLog | ไม่ทำ (ตั้งใจ, บันทึกในเฟส 8 ที่เหลือ) | ไม่มี model เลย ตรงกับ PLAN.md เฟส 8 "ที่เหลือของเฟสนี้: ... AuditLog" |

**สรุป:** 27 entity ใน PLAN.md → schema จริงมี 20 model (User, RefreshToken, PasswordResetToken, Category, Course, Lesson, Material, Quiz, QuizQuestion, QuizChoice, QuizAttempt, QuizAttemptAnswer, Enrollment, LessonProgress, QnaThread, QnaReply, TopupRequest, Account, LedgerTransaction, LedgerEntry) ครอบคลุมเฟส 1–6 และบางส่วนของถาม-ตอบ (เฟส 7) ตามที่ CLAUDE.md บันทึกไว้ ส่วนที่ขาดทั้งหมดคือ Section, LessonAttachment/MediaAsset (รวมเป็น Material), CartItem, Order, OrderItem, Certificate, Wallet(แยก), LedgerAccount(ชื่ออื่น), PayoutRequest, Review, Notification, PlatformSetting, AuditLog — ตรงกับ CLAUDE.md ยกเว้น **PlatformSetting และการหาย ratingAvg/ratingCount/enrollmentCount ที่ไม่ได้บันทึกเหตุผลชัดเจน**

### หมายเหตุ Decimal precision (สำคัญเพราะเป็นเรื่องเงิน)

CLAUDE.md §5 กำหนดว่าเงินต้องเป็น `Decimal(12,2)` และเปอร์เซ็นต์ `Decimal(5,2)` แต่ schema จริงใช้:
- `Course.price` → `Decimal(10,2)` (`schema.prisma:169`)
- `Enrollment.pricePaid` → `Decimal(10,2)` (`schema.prisma:320`)
- `TopupRequest.amount` → `Decimal(10,2)` (`schema.prisma:401`)
- `Account.balance` → `Decimal(14,2)` (`schema.prisma:434`)
- `LedgerEntry.amount` → `Decimal(14,2)` (`schema.prisma:476`)
- `User.commissionRate` / `Enrollment.commissionRateSnapshot` → `Decimal(5,4)` (ตรงตามที่ CLAUDE.md §8 ระบุไว้ชัดเจนว่าใช้ 5,4 ไม่ใช่ 5,2)

**ไม่ใช่บั๊กเชิงพฤติกรรม** (Decimal(10,2) เก็บได้ถึง 99,999,999.99 บาท ซึ่งเพียงพอ และ Account/LedgerEntry ใช้ 14,2 ที่กว้างกว่าเผื่อผลรวมสะสม) แต่เป็นความไม่ตรงกับตัวเลขที่ CLAUDE.md §5 เขียนไว้ตรงๆ (`Decimal(12,2)`) — ควรแก้เอกสารให้ตรงกับโค้ดจริง หรือบันทึกเหตุผลการเบี่ยงเบนไว้ ยังไม่พบข้อความอธิบายจุดนี้ใน CLAUDE.md §8

---

## 2. Endpoint coverage (เทียบ PLAN.md §2 กับ `backend/src/modules/**/*.controller.ts`)

หมายเหตุร่วม: ทุก endpoint ที่ไม่มี `@Public()` ถูกป้องกันโดย `JwtAuthGuard` เป็นค่าเริ่มต้น (`backend/src/app.module.ts:68` ลงทะเบียนเป็น `APP_GUARD`) — คอลัมน์ "สิทธิ์จริง" จึงหมายถึง `@Roles(...)` ที่ประกาศเพิ่ม ถ้าไม่มี `@Roles` แปลว่า "ทุกบทบาทที่ login แล้ว" ตามที่ `RolesGuard` ออกแบบไว้ (`backend/src/common/guards/roles.guard.ts:21-23`)

### auth

| Endpoint (PLAN.md) | สถานะ | หมายเหตุ |
|---|---|---|
| POST /auth/register | ทำครบแล้ว | `auth.controller.ts:36-44` `@Public()` — **แต่ไม่ส่งอีเมลยืนยัน** เพราะไม่มี email-verification flow เลย (ตรงกับ PLAN.md เฟส 2 ที่บันทึกไว้) |
| POST /auth/login | ทำครบแล้ว | `auth.controller.ts:49-57` `@Public()` + `@RateLimit('login')` (บรรทัด 47) — ตรวจ SUSPENDED ใน `auth.service.ts` |
| POST /auth/refresh | ทำครบแล้ว | `auth.controller.ts:62-70` `@Public()` หมุน token ทุกครั้ง |
| POST /auth/logout | ทำครบแล้ว | `auth.controller.ts:74-82` `@Public()` (เพิกถอน refresh token จาก cookie เอง ไม่ต้อง login) |
| GET /auth/me | ทำครบแล้ว | `auth.controller.ts:84-87` ไม่มี `@Public()` → ต้อง login |
| POST /auth/verify-email | ไม่ทำ (ตรงกับ CLAUDE.md) | grep ไม่เจอ route `verify-email` ในทั้ง backend — ไม่มี field `emailVerifiedAt` ด้วย |
| POST /auth/resend-verification | ไม่ทำ (ตรงกับ CLAUDE.md) | grep ไม่เจอ route นี้เลย |
| POST /auth/forgot-password | ทำครบแล้ว | `auth.controller.ts:92-95` `@Public()` + `@RateLimit('forgotPassword')` (บรรทัด 90) |
| POST /auth/reset-password | ทำครบแล้ว | `auth.controller.ts:99-108` `@Public()` เพิกถอนทุก session (`clearAuthCookies`) |

**ช่องว่างที่ไม่ได้บันทึกไว้**: `POST /auth/register` **ไม่มี `@RateLimit(...)`** เลย มีแค่ throttler `default` (120 req/min ต่อ IP) คุ้มครองอยู่ — PLAN.md เฟส 8 ระบุไว้ว่าต้องมี rate limit "สมัคร" ด้วย (ดูหัวข้อ 7 Rate limiting)

### users

| Endpoint (PLAN.md) | สถานะ | หมายเหตุ |
|---|---|---|
| PATCH /users/me | ทำครบแล้ว | `users.controller.ts:19-25` รับเฉพาะ 3 ฟิลด์ (`UpdateProfileDto`) ตรงกับ CLAUDE.md §8 |
| PATCH /users/me/password | ทำครบแล้ว | `users.controller.ts:27-33` เพิกถอนทุก session หลังเปลี่ยน (`users.service.ts:159`) |
| PATCH /users/me/avatar | ทำครบแล้ว | `users.controller.ts:35-41` ตรวจ key เป็นของตัวเองก่อน (`users.service.ts:98-101`) |
| GET /users/me/instructor-profile | ไม่ทำ (ตั้งใจ) | ไม่มี endpoint นี้ — ไม่มี InstructorProfile model เก็บแค่ `commissionRate` ที่ผู้ใช้แก้เองไม่ได้ (ตั้งโดย ADMIN เท่านั้น) |
| PATCH /users/me/instructor-profile | ไม่ทำ (ตั้งใจบางส่วน) | ไม่มี endpoint — bio/expertise แก้ได้ผ่าน `PATCH /users/me` แทน แต่ **ไม่มีฟิลด์บัญชีธนาคาร** เพราะ PayoutRequest ยังไม่ทำ |

### categories

| Endpoint (PLAN.md) | สถานะ | หมายเหตุ |
|---|---|---|
| GET /categories | ทำครบแล้ว | `categories.controller.ts:13-17` `@Public()` |
| POST/PATCH/DELETE /admin/categories[/:id] | ทำครบแล้ว | `admin-categories.controller.ts:15-37` `@Roles(ADMIN)` ทั้ง controller — ลบไม่ได้ถ้ามีคอร์สอยู่ (`categories.service.ts`, ยืนยันจาก `CATEGORY_IN_USE` ใน CLAUDE.md §8) |

### catalog (สาธารณะ) + instructor courses

| Endpoint (PLAN.md) | สถานะ | หมายเหตุ |
|---|---|---|
| GET /courses | ทำบางส่วน | `courses.controller.ts:39-43` `@Public()` — ใช้ query `search/categoryId/minPrice/maxPrice/freeOnly/sort/page/limit` (`course-request.dto.ts:82-126`) **ไม่มีตัวกรอง `level`, `minRating`** เพราะ schema ไม่มี field เหล่านี้ (ตรงกับ CLAUDE.md ที่บันทึกไว้สำหรับ `level`; `minRating` ไม่ได้บันทึกเหตุผลเพราะไม่มี Review เลย) |
| GET /courses/:slug | ทำบางส่วน (ใช้ `:id` แทน `:slug`) | `courses.controller.ts:58-65` route จริงคือ `GET /courses/:id` เพราะ `Course` ไม่มีคอลัมน์ `slug` เลย (`schema.prisma:157-187`) — **จุดนี้ไม่ได้บันทึกไว้ใน CLAUDE.md §8** ว่าตั้งใจตัด slug ออก ควรตรวจสอบว่าเป็นการตัดสินใจที่ตั้งใจจริงหรือพลาดไป |
| GET /courses/:slug/curriculum | ไม่ทำแยก | ไม่มี endpoint แยกสำหรับ curriculum อย่างเดียว — `GET /courses/:id` คืน `lessons[]` แบบย่อ (ไม่มี video key) มาให้ในตัวอยู่แล้ว (`courses.service.ts:148-157`) จึงไม่จำเป็นต้องมี endpoint แยก |
| GET /courses/:id/reviews | ไม่ทำ (ตั้งใจ, บันทึกในเฟส 7) | ไม่มี Review model เลย |
| GET /instructors/:id | **ไม่ทำ และไม่มีบันทึกเหตุผลใน CLAUDE.md** | grep ไม่เจอ route `instructors` ในทุก controller — PLAN.md เฟส 3 บันทึกไว้ชัดว่านี่คือสิ่งที่เหลือของเฟส 3 (`PLAN.md:466`) แต่ CLAUDE.md §8 ไม่ได้พูดถึงอีกเลยว่าทำหรือไม่ทำ — ยืนยันจาก controller ว่ายังไม่ทำ |
| GET /certificates/:code | ไม่ทำ (ตั้งใจ, บันทึกในเฟส 6/7) | ไม่มี Certificate model/endpoint เลย |
| GET/POST /instructor/courses | ทำครบแล้ว (เปลี่ยน path) | จริงคือ `GET /courses/mine` (`courses.controller.ts:46-49`) และ `POST /courses` (บรรทัด 68-74) ไม่ใช่ `/instructor/courses` — `@Roles(INSTRUCTOR, ADMIN)` ตรงกัน |
| GET/PATCH /instructor/courses/:id | ทำครบแล้ว (เปลี่ยน path) | จริงคือ `GET /courses/:id` (public, มี `@OptionalUser`) และ `PATCH /courses/:id` (บรรทัด 76-84) ตรวจเจ้าของผ่าน `CourseAccessService.assertCourseOwner` (`course-access.service.ts:27-41`) |
| DELETE /instructor/courses/:id | ทำครบแล้ว (เปลี่ยน path) | จริงคือ `DELETE /courses/:id` (`courses.controller.ts:87-93`) เฉพาะ DRAFT ไม่มีคนซื้อ (`courses.service.ts:302-312`) |
| POST /instructor/courses/:id/submit | ทำครบแล้ว (เปลี่ยน path) | จริงคือ `POST /courses/:id/submit` (`courses.controller.ts:97-103`) ตรวจครบ 3 เงื่อนไข (`courses.service.ts:358-370`) |
| POST /instructor/courses/:id/unpublish | ทำครบแล้ว (เปลี่ยน path) | จริงคือ `POST /courses/:id/unpublish` (`courses.controller.ts:108-114`) |
| POST/PATCH/DELETE /instructor/courses/:id/sections[/:sectionId] | ไม่ทำ (ตั้งใจ, ไม่มี Section model) | ไม่มี Section เลย — บทเรียนผูกกับ Course ตรงๆ |
| PATCH /instructor/courses/:id/sections/reorder | ไม่ทำ (ตั้งใจ) | เช่นเดียวกับข้างบน |
| POST/PATCH/DELETE /instructor/sections/:id/lessons[/:lessonId] | ทำครบแล้ว (เปลี่ยน path ตัดชั้น section) | จริงคือ `POST /courses/:courseId/lessons`, `PATCH /lessons/:id`, `DELETE /lessons/:id` (`lessons.controller.ts:40-76`) `@Roles(INSTRUCTOR, ADMIN)` ทุกตัว |
| PATCH /instructor/sections/:id/lessons/reorder | ทำครบแล้ว (เปลี่ยน path) | จริงคือ `PATCH /courses/:courseId/lessons/reorder` (`lessons.controller.ts:50-57`) ใช้เทคนิคพัก orderIndex ติดลบตามที่ CLAUDE.md บันทึก |
| GET/POST/PATCH/DELETE /instructor/courses/:id/quizzes[/:quizId] | ทำบางส่วน (เปลี่ยน path ผูกกับ lesson) | จริงคือ `POST /lessons/:id/quiz`, `PATCH /quizzes/:id`, `DELETE /quizzes/:id` (`quizzes.controller.ts:32-58`) **ไม่มี `GET /instructor/courses/:id/quizzes` (list)** — instructor ต้องอ่าน quiz ทีละตัวผ่าน response ของ `create`/`update` เท่านั้น ไม่มี endpoint list สำหรับฝั่งผู้สอนโดยตรง (ตรงกับ CLAUDE.md ที่บอกว่ายังไม่มีหน้าจอสร้างข้อสอบ — API ก็ไม่ครบสำหรับ list) |
| POST/PATCH/DELETE /instructor/quizzes/:id/questions[/:questionId] | ไม่ทำแยก (ตั้งใจ) | ไม่มี endpoint แก้ทีละคำถาม — `PATCH /quizzes/:id` เขียนทับคำถามทั้งชุดเสมอ (`quizzes.service.ts:106-130`) ตรงกับ CLAUDE.md §8 ที่บันทึกไว้ชัดเจน |
| GET /instructor/courses/:id/students | ไม่ทำ และไม่มีบันทึกเหตุผลใน CLAUDE.md | grep ไม่เจอ endpoint รายชื่อผู้เรียนต่อคอร์สเลย — ไม่ปรากฏใน CLAUDE.md §8 ว่าตัดทิ้งหรือยังไม่ทำ เป็นช่องว่างที่ไม่มีเอกสารรับรอง |

### media / uploads / lessons streaming

| Endpoint (PLAN.md) | สถานะ | หมายเหตุ |
|---|---|---|
| POST /media/presign-upload | ทำครบแล้ว (เปลี่ยนชื่อ) | จริงคือ `POST /uploads/presign` (`uploads.controller.ts:17-23`) ไม่มี `@Roles` = ทุกบทบาท login แล้ว ตรวจ kind/mimeType/size ใน `uploads.service.ts` ผ่าน `upload-rules.ts` |
| POST /media/:id/complete | ไม่ทำ (ตั้งใจ, ไม่มี MediaAsset model) | ไม่มีขั้นตอน "complete" เพราะไม่มี status PENDING/READY ระดับ DB — ขนาด/การมีอยู่จริงถูกตรวจสดจาก `storage.stat()` ทุกครั้งที่ใช้งานแทน (เช่น `topups.service.ts:300-313`, `users.service.ts:97-106`) |
| GET /lessons/:id/stream | ทำครบแล้ว | `lessons.controller.ts:86-110` proxy stream จริง รองรับ Range (206/`Content-Range`) ไม่มี `@Roles` (ทุกบทบาท login แล้ว, ตรวจสิทธิ์จริงใน `lessons.service.ts` ผ่าน `CourseAccessService.canReadLessonContent`) |
| GET /lessons/:id/attachments/:assetId | ทำบางส่วน (รวมเข้ากับ lesson detail แทน) | ไม่มี endpoint แยก — เอกสารแนบมาพร้อม `GET /learn/:courseId/lessons/:lessonId` เป็น `downloadUrl` ที่ presign แล้ว (`learn.service.ts:155-163`) แทน สำหรับฝั่งผู้สอนแก้ไข ใช้ `POST /lessons/:lessonId/materials`, `DELETE /materials/:id` (`materials.controller.ts`) |

### wallet และเติมเงิน

| Endpoint (PLAN.md) | สถานะ | หมายเหตุ |
|---|---|---|
| GET /wallet | ทำครบแล้ว | `wallet.controller.ts:20-26` ไม่มี `@Roles` (ทุกบทบาท) |
| GET /wallet/transactions | ทำครบแล้ว (รวมเข้ากับ GET /wallet) | ไม่มี endpoint แยก — `GET /wallet` คืนทั้งยอดคงเหลือและ `entries[]` แบ่งหน้าในคำตอบเดียว (`ledger.service.ts:186-202`) |
| POST /wallet/topups | ทำครบแล้ว (เปลี่ยน path) | จริงคือ `POST /topups` (`topups.controller.ts:29-35`) `@Roles(STUDENT, INSTRUCTOR)` — แยก quote (`POST /topups/quote`, ไม่เขียน DB) ออกจาก create (เขียน DB พร้อม slip แนบมาด้วยเลย) |
| GET /wallet/topups · /wallet/topups/:id | ทำบางส่วน (เปลี่ยน path, ไม่มี GET เดี่ยว) | จริงคือ `GET /topups/mine` (list, บรรทัด 37-43) **ไม่มี `GET /topups/:id` (รายการเดียว)** — grep ไม่เจอ route นี้ในทั้ง `topups.controller.ts` |
| POST /wallet/topups/:id/slip | ไม่ทำแยก (ตั้งใจ) | ไม่มี endpoint แนบสลิปทีหลัง เพราะ `POST /topups` ต้องมี `slipKey` มาตั้งแต่ต้น (`CreateTopupDto`, `topup-request.dto.ts:21-30`) ไม่มีสถานะ `AWAITING_SLIP` ระดับ DB เลย (`TopupStatus` enum มีแค่ PENDING/APPROVED/REJECTED/CANCELLED, `schema.prisma:44-50`) |
| POST /wallet/topups/:id/cancel | ทำครบแล้ว (เปลี่ยน path) | จริงคือ `POST /topups/:id/cancel` (`topups.controller.ts:46-52`) เฉพาะเจ้าของและสถานะ PENDING เท่านั้น |

### ตะกร้าและคำสั่งซื้อ

| Endpoint (PLAN.md) | สถานะ | หมายเหตุ |
|---|---|---|
| GET /cart, POST /cart/items, DELETE /cart/items/:courseId, /cart | ไม่ทำ (ตั้งใจ, บันทึกชัดเจนใน CLAUDE.md/PLAN.md) | ไม่มี CartItem model / controller เลย |
| POST /orders/checkout 💰, GET /orders, GET /orders/:id | ไม่ทำ (ตั้งใจ) | ไม่มี Order/OrderItem — แทนที่ด้วย `POST /courses/:id/purchase` ทีละคอร์ส (`enrollments.controller.ts:39-46`) ซึ่งทำ 💰 ครบใน transaction เดียวตามกติกา (ดูหัวข้อ money-transaction safety) |

### การเรียน

| Endpoint (PLAN.md) | สถานะ | หมายเหตุ |
|---|---|---|
| GET /me/enrollments | ทำครบแล้ว (เปลี่ยน path) | จริงคือ `GET /enrollments/mine` (`enrollments.controller.ts:48-51`) `@Roles(STUDENT,INSTRUCTOR,ADMIN)` |
| GET /me/enrollments/:courseId | ทำครบแล้ว (เปลี่ยน path) | จริงคือ `GET /learn/:courseId` (`learn.controller.ts:26-32`) คืน curriculum+progress ตรงตามสเปก แต่ `@Roles(STUDENT, INSTRUCTOR)` **ไม่รวม ADMIN** (ตั้งใจ ตาม CLAUDE.md §8 "ห้องเรียนเข้าได้เฉพาะคนที่มีแถว Enrollment") |
| POST /lessons/:id/progress | ทำครบแล้ว (เปลี่ยน path) | จริงคือ `PATCH /progress/:lessonId` (`learn.controller.ts:44-51`) |
| POST /lessons/:id/complete | ทำครบแล้ว (เปลี่ยน path) | จริงคือ `POST /progress/:lessonId/complete` (`learn.controller.ts:55-61`) idempotent ตามที่ CLAUDE.md บันทึก |
| GET /me/enrollments/:courseId/certificate | ไม่ทำ (ตั้งใจ, บันทึกในเฟส 6/7) | ไม่มี Certificate model/endpoint |

### แบบทดสอบ (ฝั่งผู้เรียน)

| Endpoint (PLAN.md) | สถานะ | หมายเหตุ |
|---|---|---|
| GET /courses/:courseId/quizzes | ไม่ทำแยก | ไม่มี endpoint list quiz ต่อคอร์สฝั่งผู้เรียน — quiz มาพร้อม `GET /learn/:courseId/lessons/:lessonId` เป็น `quiz` object ต่อบทเรียนแทน (`learn.service.ts:164`) เพราะ 1 บทเรียนมี quiz ได้อย่างมาก 1 ชุด |
| GET /quizzes/:id | ทำครบแล้ว (เปลี่ยน path) | จริงคือ `GET /quizzes/:id/take` (`quizzes.controller.ts:63-66`) ไม่มี `isCorrect` ใน type `QuizTakeDto` เลย (ยืนยันจาก `quizzes.service.ts:151-177`) |
| POST /quizzes/:id/attempts | ทำครบแล้ว (เปลี่ยน path) | จริงคือ `POST /quizzes/:id/submit` (`quizzes.controller.ts:68-75`) ตรวจ+บันทึกคำตอบในการเรียกเดียว ไม่มีขั้น "เริ่ม attempt" แยก เพราะไม่มี concept ทำค้างไว้ (ตั้งใจ ตาม CLAUDE.md) |
| PATCH /attempts/:id/answers | ไม่ทำ (ตั้งใจ) | ไม่มี endpoint บันทึกคำตอบระหว่างทำ เพราะไม่มีสถานะ IN_PROGRESS ใน schema (`QuizAttempt` ไม่มี `status`) |
| POST /attempts/:id/submit | ทำครบแล้ว (รวมกับ submit ข้างบน) | เหมือนกับ `POST /quizzes/:id/submit` |
| GET /attempts/:id | ไม่ทำแยก | ไม่มี endpoint ดู attempt เดี่ยวด้วย id ของ attempt — ใช้ `GET /quizzes/:id/attempts/mine` ที่คืนทั้งประวัติ + `latestResult` แทน (`quizzes.controller.ts:77-83`) |
| GET /quizzes/:id/attempts | ทำครบแล้ว | `GET /quizzes/:id/attempts/mine` (`quizzes.controller.ts:77-83`) คืนประวัติทุกครั้งพร้อมเฉลยครั้งล่าสุด |

### รีวิว

| Endpoint (PLAN.md) | สถานะ | หมายเหตุ |
|---|---|---|
| POST /courses/:id/reviews | ไม่ทำ (ตั้งใจ, บันทึกในเฟส 7) | ไม่มี Review model/endpoint เลย |
| PATCH/DELETE /reviews/:id | ไม่ทำ (ตั้งใจ) | เช่นเดียวกับข้างบน |

### ถาม–ตอบ

| Endpoint (PLAN.md) | สถานะ | หมายเหตุ |
|---|---|---|
| GET /courses/:id/qna | ทำครบแล้ว | `qna.controller.ts:34-41` ไม่มี `@Roles` — ตรวจสิทธิ์จริงใน `resolveQnaAccess` (`course-access.service.ts:152-180`) |
| POST /courses/:id/qna | ทำครบแล้ว | `qna.controller.ts:43-50` ตรวจ `canAsk` (ต้องลงทะเบียนแล้ว, ผู้สอนถามเองไม่ได้) |
| GET /qna/:threadId | ทำครบแล้ว | `qna.controller.ts:66-72` |
| POST /qna/:threadId/replies | ทำครบแล้ว | `qna.controller.ts:74-81` ตรวจ `canReply` (ADMIN ตอบไม่ได้ ตามที่ CLAUDE.md บันทึก) |
| PATCH /qna/:threadId/status | ทำครบแล้ว (เปลี่ยน path) | จริงคือ `PATCH /qna/:threadId/resolve` (`qna.controller.ts:83-90`) รับ `{isResolved}` แทนสถานะ enum 3 ค่า เพราะ `QnaThread` ไม่มี field `status` (มีแค่ boolean `isResolved`) |
| GET /instructor/qna | ทำครบแล้ว (เปลี่ยน path) | จริงคือ `GET /instructor/qna/pending` (`qna.controller.ts:57-64`) `@Roles(INSTRUCTOR, ADMIN)` — ตัด thread ที่ `isResolved: true` ออกตามที่ CLAUDE.md บันทึก |
| — (เพิ่มเติมนอก PLAN.md) | ทำครบแล้ว | `DELETE /qna/:threadId` (`qna.controller.ts:92-98`) มีเพิ่มจาก PLAN.md — ผู้ถาม/เจ้าของคอร์ส/ADMIN ลบได้ |

### รายได้และการถอนเงินของผู้สอน

| Endpoint (PLAN.md) | สถานะ | หมายเหตุ |
|---|---|---|
| GET /instructor/sales | ไม่ทำแยก (แทนที่ด้วย endpoint อื่น) | ไม่มี endpoint นี้ตรงๆ — ตัวเลขยอดขายรวมอยู่ใน `GET /instructor/reports/overview` แทน (`reports.controller.ts:60-69`) |
| GET /instructor/earnings | ไม่ทำแยก (แทนที่ด้วย endpoint อื่น) | เช่นเดียวกับข้างบน — `InstructorOverviewDto` **ไม่มีฟิลด์ "ยอดถอนได้/ยอดถอนแล้ว"** เพราะยังไม่มี PayoutRequest (ต้องตรวจ `reports.service.ts` เพิ่มตอนทำเฟส 7) |
| GET/POST /instructor/payouts | ไม่ทำ (ตั้งใจ, บันทึกในเฟส 7) | ไม่มี PayoutRequest model/endpoint เลย |
| GET /instructor/payouts/:id | ไม่ทำ (ตั้งใจ) | เช่นเดียวกับข้างบน |

### admin

| Endpoint (PLAN.md) | สถานะ | หมายเหตุ |
|---|---|---|
| GET /admin/topups?status= | ทำครบแล้ว | `admin-topups.controller.ts:20-23` `@Roles(ADMIN)` ทั้ง controller |
| GET /admin/topups/:id | ไม่ทำแยก | grep ไม่เจอ `GET /admin/topups/:id` — มีแต่ `GET /admin/topups` (list) ที่คืน `slipUrl` ต่อแถวอยู่แล้ว (`topups.service.ts:340`) จึงอาจไม่จำเป็นต้องมี endpoint เดี่ยว แต่เป็นความต่างจาก PLAN.md |
| POST /admin/topups/:id/approve 💰 | ทำครบแล้ว (PATCH แทน POST) | `admin-topups.controller.ts:25-31` ใช้ `@Patch` ไม่ใช่ `@Post` เขียน ledger ผ่าน `WalletService.approveTopup` ครบ (ดูหัวข้อ money-transaction safety) **ไม่มีการแจ้งเตือน** เพราะไม่มี Notification model |
| POST /admin/topups/:id/reject | ทำครบแล้ว (PATCH แทน POST) | `admin-topups.controller.ts:33-40` ต้องระบุเหตุผล (`RejectTopupDto`, `topup-request.dto.ts:32-38`) |
| GET /admin/courses?status= | ทำบางส่วน (ไม่มี query filter) | จริงคือ `GET /admin/courses/pending` (`admin-courses.controller.ts:14-17`) **ตายตัวที่ PENDING_REVIEW เท่านั้น ไม่รับ `?status=` เพื่อดูสถานะอื่น** (`ListPendingCoursesQueryDto` มีแค่ page/limit, `course-request.dto.ts:128-141`) |
| POST /admin/courses/:id/approve · /reject | ทำครบแล้ว (PATCH แทน POST) | `admin-courses.controller.ts:19-27` กันสองแท็บกดทับกันด้วย `assertUnderReview` (`course-review.service.ts:112-126`) |
| GET /admin/users · /admin/users/:id | ทำบางส่วน | มี `GET /admin/users` (list, `admin-users.controller.ts:23-26`) **แต่ไม่มี `GET /admin/users/:id` (รายละเอียดผู้ใช้เดี่ยว)** — grep ไม่เจอใน `users.controller.ts`/`admin-users.controller.ts`/`users.service.ts` เลย (ไม่มีเมธอด `findOne` ฝั่ง admin) |
| PATCH /admin/users/:id/status | ทำครบแล้ว | `admin-users.controller.ts:28-35` กันระงับตัวเอง (`CannotSuspendSelfException`, `users.service.ts:215-217`) |
| PATCH /admin/users/:id/revenue-share | ทำครบแล้ว (เปลี่ยนชื่อ path) | จริงคือ `PATCH /admin/users/:id/commission` (`admin-users.controller.ts:37-40`) จำกัดเฉพาะ INSTRUCTOR และไม่เกิน `MAX_COMMISSION_RATE` (`users.service.ts:237-256`) |
| GET /admin/payouts?status= | ไม่ทำ (ตั้งใจ, บันทึกในเฟส 7) | ไม่มี endpoint/model เลย |
| POST /admin/payouts/:id/approve 💰 · /reject | ไม่ทำ (ตั้งใจ) | เช่นเดียวกับข้างบน |
| PATCH /admin/reviews/:id/status | ไม่ทำ (ตั้งใจ, บันทึกในเฟส 7) | ไม่มี Review เลย |
| GET /admin/reports/overview | ทำครบแล้ว | `reports.controller.ts:26-29` |
| GET /admin/reports/sales | ทำครบแล้ว (เปลี่ยนชื่อ) | จริงคือ `GET /admin/reports/sales-daily` (`reports.controller.ts:31-34`) — เพิ่ม `GET /admin/reports/top-courses`, `/top-instructors` นอกเหนือ PLAN.md ด้วย (บรรทัด 36-44) |
| GET /admin/reports/ledger | ทำครบแล้ว | `reports.controller.ts:46-50` งบทดลอง พิสูจน์ Σdebit=Σcredit ตรงสเปก |
| GET/PATCH /admin/settings | **ไม่ทำ และไม่มีบันทึกเหตุผลใน CLAUDE.md** | grep ไม่เจอ controller/route `admin/settings` เลย ไม่มี `PlatformSetting` model รองรับด้วย — ค่าที่ควรตั้งได้แบบ runtime (ส่วนแบ่งเริ่มต้น, PromptPay ID, ยอดถอนขั้นต่ำ) ทั้งหมดตอนนี้ hardcode ผ่าน `.env`/`@default` ใน schema แทน |
| GET /admin/audit-logs | ไม่ทำ (ตั้งใจ, บันทึกใน PLAN.md เฟส 8 ที่เหลือ) | ไม่มี AuditLog model/endpoint เลย |

### notifications

| Endpoint (PLAN.md) | สถานะ | หมายเหตุ |
|---|---|---|
| GET /notifications · POST /notifications/:id/read · POST /notifications/read-all | ไม่ทำ (ตั้งใจ, บันทึกในเฟส 7) | ไม่มี Notification model/endpoint/module เลย — ไม่อยู่ใน `app.module.ts` imports |

### endpoint เพิ่มเติมนอก PLAN.md ที่พบระหว่างตรวจ (ไม่ได้อยู่ใน §2 แต่มีจริง)

- `GET /courses/mine/stats` (`courses.controller.ts:52-55`) — สรุปสถิติสำหรับแดชบอร์ดผู้สอน
- `GET /stats/public` (`stats.controller.ts:9-13`) — ตัวเลขสาธารณะหน้าแรก `@Public()`
- `GET /instructor/reports/overview` (`reports.controller.ts:65-68`) — แทนที่ `/instructor/sales` + `/instructor/earnings` ของ PLAN.md
- `GET /admin/reports/top-courses`, `GET /admin/reports/top-instructors` (`reports.controller.ts:36-44`)
- `DELETE /qna/:threadId` (`qna.controller.ts:92-98`)
- `GET /uploads/signed-url/*key` (`uploads.controller.ts:29-35`) — คืน presigned GET สำหรับ key ทั่วไป **ยืนยันแล้วว่าปฏิเสธ kind `video` เสมอ** (`uploads.service.ts:108-110` throw `VideoNotDownloadableException`) ตรงตามข้อห้าม 10 ทุกกรณี รวมถึง ADMIN

---

## 3. Frontend–backend contract check

ตรวจจาก `frontend/src/lib/**/*.ts` (ทุกไฟล์ `api.ts` ที่เรียก `apiRequest(...)`) และ `frontend/src/app/**/*.tsx` (ที่เรียก `serverFetch(...)`) เทียบกับ route จริงในหัวข้อ 2

**ผลตรวจ: ไม่พบ path ฝั่ง frontend ที่ยิงไปแล้วไม่มี backend route รองรับ (จะ 404 จริง)** ตรวจนับได้ทั้งหมด ~70 จุดเรียก ตัวอย่างที่ตรวจแล้วตรงกันเป๊ะ:

- `frontend/src/lib/wallet/api.ts:20,27,31,35,40,48,52` → `/wallet`, `/topups/quote`, `/topups`, `/topups/mine`, `/topups/:id/cancel`, `/courses/:id/purchase`, `/enrollments/mine` ตรงกับ `wallet.controller.ts`, `topups.controller.ts`, `enrollments.controller.ts` ทุกจุด
- `frontend/src/lib/admin/api.ts:65-165` → `/admin/users`, `/admin/users/:id/status`, `/admin/users/:id/commission`, `/admin/courses/pending`, `/admin/courses/:id/approve|reject`, `/admin/categories[/:id]`, `/admin/reports/*`, `/instructor/reports/overview` ตรงกับ controller ทุกจุด — **ยืนยันด้วยว่า frontend ไม่เรียก `GET /admin/users/:id` เดี่ยวเลย** (สอดคล้องกับที่ backend ไม่มี endpoint นี้จริง ตามหัวข้อ 2)
- `frontend/src/lib/qna/api.ts`, `frontend/src/lib/learn/api.ts`, `frontend/src/lib/catalog/api.ts` → ตรงกับ `qna.controller.ts`, `learn.controller.ts`, `quizzes.controller.ts`, `courses.controller.ts`, `lessons.controller.ts`, `materials.controller.ts`, `uploads.controller.ts` ทุกจุด
- `frontend/src/app/(public)/page.tsx:27-29` → `/stats/public`, `/categories`, `/courses?sort=popular&limit=...` ตรงกับ `stats.controller.ts:9-13`
- `frontend/src/app/(public)/courses/[id]/page.tsx:45,75` → `/courses/:id`, `/wallet?page=1&limit=1` ตรงกับ backend

**Path ที่ปรากฏใน frontend แต่ไม่ใช่การเรียก API จริง (route guard เฉยๆ ไม่นับเป็น mismatch):**
`frontend/src/middleware.ts:29-31` มี string `/cart`, `/checkout`, `/orders` อยู่ในรายการเส้นทางที่ middleware รู้จัก แต่ไม่มีหน้า Next.js จริงให้เข้าและไม่มี backend รองรับ — เป็นเศษ config ที่ไม่มีผลอะไร (ไม่ error) แต่ไม่ควรทำให้เข้าใจผิดว่ามีตะกร้าแล้ว

**Backend endpoint ที่ไม่มี frontend เรียกเลย (orphaned, priority ต่ำ ไม่ใช่บั๊ก):**

| Endpoint | หมายเหตุ |
|---|---|
| `POST /lessons/:id/quiz`, `PATCH /quizzes/:id`, `DELETE /quizzes/:id` (instructor สร้าง/แก้ข้อสอบ) | ตรงกับที่ CLAUDE.md บันทึกไว้ว่า "ยังไม่มีหน้าจอให้ผู้สอนสร้างข้อสอบ" — API พร้อมแล้ว รอ UI — ยืนยันจาก `frontend/src/lib/catalog/api.ts` ไม่มี wrapper สำหรับ 3 endpoint นี้เลย |

หมายเหตุแก้ไข: ตรวจซ้ำพบว่า `DELETE /qna/:threadId` **มีการเรียกจริง** จาก `frontend/src/lib/qna/api.ts:46` (`apiRequest(...,{method:"DELETE"})`) จึงไม่ใช่ endpoint กำพร้า — ตัดออกจากตารางนี้แล้ว

---

## 4. Money-transaction transaction-safety findings

ตรวจ `backend/src/modules/ledger/ledger.service.ts`, `backend/src/modules/ledger/wallet.service.ts`, `backend/src/modules/topups/topups.service.ts` และค้นทั้ง repo หา query ที่แตะ `Account`/`LedgerEntry`/`LedgerTransaction` นอกสองไฟล์นี้

**สรุป: กติกาเรื่องเงินทั้งหมดถูกปฏิบัติตามครบถ้วน ไม่พบช่องโหว่**

| กติกา (CLAUDE.md §5/§7) | ผลตรวจ | หลักฐาน |
|---|---|---|
| ทุก endpoint ที่แตะเงินอยู่ใน `prisma.$transaction` | ผ่าน | `wallet.service.ts:59` (`approveTopup`), `:127` (`rejectTopup`), `:168` (`purchaseCourse`) ทั้งสามเมธอดเปิด `this.prisma.$transaction(async (tx) => {...}, MONEY_TRANSACTION_OPTIONS)` ครอบทั้งฟังก์ชัน |
| ล็อกแถว wallet/account ด้วย `SELECT ... FOR UPDATE` ก่อนอ่านยอด | ผ่าน | `ledger.service.ts:62-68` (`lockAccounts`) ใช้ raw SQL `FOR UPDATE` เรียง `ORDER BY id` ก่อนเสมอ กันเดดล็อก — เรียกจาก `wallet.service.ts:68` (approve), `:239` (purchase) ก่อนอ่าน `balanceBefore` ทุกครั้ง — `topupRequest` เองก็ถูกล็อกด้วย raw `FOR UPDATE` แยกต่างหาก (`wallet.service.ts:341-346`, `lockTopupRequest`) ก่อนอ่านสถานะ |
| ทุก transaction บันทึก ledger entry คู่กัน และ Σdebit = Σcredit ต้องเท่ากันก่อน commit | ผ่าน | `ledger.service.ts:84-104` (`postTransaction`) คำนวณ `debitTotal`/`creditTotal` แล้ว throw `UnbalancedLedgerException` ถ้าไม่เท่ากันหรือมี entry น้อยกว่า 2 แถว **ก่อน**เขียนอะไรลง DB เลย |
| `idempotencyKey` unique กันเขียนซ้ำ | ผ่าน | schema กำหนด `@unique` (`schema.prisma:454`) และใช้จริงเป็น `` `topup:${id}` `` / `` `purchase:${enrollment.id}` `` (`wallet.service.ts:83`, `:286`) |
| `Wallet.balance`/`Account.balance` อัปเดตในธุรกรรมเดียวกับ ledger เสมอ | ผ่าน | `ledger.service.ts:131-139` อัปเดต `balance` ด้วย raw SQL ภายใน `tx` เดียวกับที่สร้าง `ledgerTransaction`/`ledgerEntry` ไม่มีทางแยกออกจากกันได้ |
| ห้ามลบ/แก้ `LedgerEntry`/`LedgerTransaction` ที่บันทึกแล้ว | ผ่าน (มีข้อยกเว้นที่อธิบายไว้แล้ว) | ไม่พบ `.update()`/`.delete()` บน `ledgerEntry`/`ledgerTransaction` ในโค้ด production เลย (grep `tx.ledgerTransaction.create` เจอจุดเดียวคือสร้าง ไม่มี update/delete) จุดเดียวที่มีการ "แก้" คือใน `backend/src/modules/reports/reports.service.spec.ts` (ทดสอบ, ไม่ใช่ production code) ตามที่ CLAUDE.md §8 ระบุไว้แล้วว่าเลื่อน `createdAt` ย้อนหลังในเทสต์เท่านั้น |
| ปัดเศษ half-up + รายได้ผู้สอน = ราคา − ค่าธรรมเนียม | ผ่าน | `wallet.service.ts:252-255` `platformAmount = price.mul(commissionRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)` แล้ว `instructorAmount = price.minus(platformAmount)` ตรงตามกติกาเป๊ะ — entry ที่เป็น 0 ถูกกรองออกไม่เขียนลง ledger (`wallet.service.ts:264-282`, `.filter(entry => entry.amount.greaterThan(ZERO))`) |
| ไม่มีจุดอื่นในระบบที่เขียน `Account`/ledger นอก `ledger.service.ts`/`wallet.service.ts` | ผ่าน | grep `tx.account.\|prisma.account.\|ledgerTransaction.create\|ledgerEntry.create\|Account.update` ทั้ง repo (`backend/src`) เจอเฉพาะ: `ledger.service.ts:113` (create tx), `wallet.service.ts:143,215` (อ่านยอดหลัง reject/free-course, ไม่เขียน), `ledger.service.ts:290` (อ่าน), `auth.service.ts:80` (สร้าง Account เปล่าตอนสมัครสมาชิก ยอด 0 ไม่ใช่ money movement), `reports.service.ts:325` (อ่านอย่างเดียว) — **ไม่พบจุดเขียนเงินนอกสองไฟล์ที่ควรเป็นเจ้าของ** |
| `TopupsService` (`create`/`cancel`) ไม่แตะ balance โดยตรง | ผ่าน | `topups.service.ts:130-178` สร้าง/ยกเลิกคำขอเป็นแค่ status flip บนตาราง `TopupRequest` เท่านั้น ไม่มี ledger call เลย — เรียก `this.wallet.approveTopup`/`rejectTopup` เฉพาะตอน `approve()`/`reject()` (บรรทัด 239-252) |
| ขนาดสลิป/ยอดเงินเชื่อจาก MinIO `stat()` ไม่ใช่จาก body | ผ่าน | `topups.service.ts:300-313` (`assertSlipUsable`) เรียก `this.storage.stat(slipKey)` แล้วเทียบ `sizeBytes` จริง ไม่เชื่อ client |

**Race-condition / double-submit**: `purchaseCourse` ทำ fast-path check (`wallet.service.ts:194-200`) แล้วพึ่ง unique index `@@unique([courseId, studentId])` (`schema.prisma:330`) เป็นตัวกันจริงผ่าน `createEnrollment()` ที่ดัก Prisma error `P2002` แปลงเป็น `AlreadyEnrolledException` (`wallet.service.ts:314-331`) — ถูกต้องตามที่ CLAUDE.md อธิบาย "การเช็คด้วย findUnique ก่อนหน้าเป็นเพียงทางลัด ไม่ใช่ตัวกันจริง"

**ไม่พบข้อผิดพลาดในหมวดนี้เลย** — เป็นส่วนที่ implement ได้แข็งแรงที่สุดของ backend

---

## 5. RBAC / ownership findings

### Guard chain ระดับ global

`backend/src/app.module.ts:67-69` ลงทะเบียน `ThrottlerGuard` → `JwtAuthGuard` → `RolesGuard` ตามลำดับที่ถูกต้อง (rate-limit ก่อน auth ก่อน role) `JwtAuthGuard` (`common/guards/jwt-auth.guard.ts:54-128`) เป็น fail-closed: ปฏิเสธทุก route ที่ไม่ติด `@Public()` เป็นค่าเริ่มต้น ตรงตาม CLAUDE.md §5 "ทุก endpoint ต้องระบุสิทธิ์ชัดเจน default คือ 'ต้อง login'"

### Ownership checks (ชั้นที่สองตาม CLAUDE.md "ตรวจสิทธิ์ 2 ชั้นเสมอ")

| Module | Ownership check | หลักฐาน |
|---|---|---|
| courses/lessons/materials/uploads (material) | `CourseAccessService.assertCourseOwner` / `assertLessonOwner` / `canReadLessonContent` เป็นจุดเดียวที่ทุก service เรียกใช้ | `course-access.service.ts:27-108` — ยืนยันว่าถูกเรียกจริงจาก `courses.service.ts:256,303,343,394`, `uploads.service.ts:167` |
| learn/quizzes (ฝั่งผู้เรียน) | `CourseAccessService.assertEnrolled` บังคับต้องมี `Enrollment` แถวจริง ไม่มีทางผ่านด้วย role อย่างเดียว | `course-access.service.ts:127-138`, เรียกจาก `learn.service.ts:77,118,236`, `quizzes.service.ts:324` |
| qna | `CourseAccessService.resolveQnaAccess` คำนวณ `isInstructor/isAdmin/isEnrolled/canAsk/canReply` ครบ 5 ค่าและ throw ทันทีถ้าอ่านบอร์ดไม่ได้เลย | `course-access.service.ts:152-180`, ใช้ทุกเมธอดใน `qna.service.ts` |
| topups (self-review) | ป้องกัน ADMIN อนุมัติคำขอของตัวเอง | `topups.service.ts:265-277` (`assertReviewable`) throw `CannotReviewOwnTopupException` ถ้า `request.studentId === admin.id` |
| users (self-suspend) | ป้องกัน ADMIN ระงับบัญชีตัวเอง | `users.service.ts:215-217` |
| enrollments/wallet (identity) | `courseId`/`userId` มาจาก JWT (`@CurrentUser()`) เท่านั้น ไม่มี endpoint ไหนรับ `userId` จาก body/param | ยืนยันจากทุก controller ที่อ่านแล้ว (`enrollments.controller.ts:41-51`, `wallet.controller.ts:20-26` เป็นต้น) |

### `@Roles()` เทียบกับ PLAN.md §2 (โฟกัสโมดูลหลังเฟส 3 ตามที่ระบุในโจทย์)

| Controller | `@Roles(...)` จริง | ตรงกับ PLAN.md หรือไม่ |
|---|---|---|
| `admin-courses.controller.ts:9` | `ADMIN` | ตรง |
| `admin-topups.controller.ts:15` | `ADMIN` | ตรง |
| `admin-users.controller.ts:18` | `ADMIN` | ตรง |
| `admin-categories.controller.ts:13` | `ADMIN` | ตรง |
| `AdminReportsController` (`reports.controller.ts:21`) | `ADMIN` | ตรง |
| `InstructorReportsController` (`reports.controller.ts:60`) | `INSTRUCTOR, ADMIN` | สมเหตุสมผล (ADMIN ควรดูรายงานของผู้สอนได้เพื่อ debug) — PLAN.md เขียนแค่ INSTRUCTOR แต่การเพิ่ม ADMIN ไม่ใช่ช่องโหว่ |
| `topups.controller.ts:17` | `STUDENT, INSTRUCTOR` (ADMIN ตัดออกตั้งใจ) | ตรงกับ CLAUDE.md §8 ("ADMIN เติมเงินไม่ได้") |
| `enrollments.controller.ts:24` | `STUDENT, INSTRUCTOR, ADMIN` | ตรงกับ CLAUDE.md §8 ที่อธิบายเหตุผลว่าทำไมรวม ADMIN |
| `learn.controller.ts:21` | `STUDENT, INSTRUCTOR` (ADMIN ตัดออกตั้งใจ) | ตรงกับ CLAUDE.md §8 |
| `quizzes.controller.ts` (ฝั่งผู้เรียน) | ไม่มี `@Roles` เลย (บรรทัด 63,68,77) | ตั้งใจ ตามคอมเมนต์ในไฟล์บรรทัด 20-24 — ตรวจสิทธิ์จริงผ่าน `assertEnrolled` ในเซอร์วิส ไม่ใช่ role |
| `qna.controller.ts` (บอร์ด) | ไม่มี `@Roles` ยกเว้น `instructor/qna/pending` ที่เป็น `INSTRUCTOR, ADMIN` (บรรทัด 57) | ตั้งใจ ตรวจผ่าน `resolveQnaAccess` |
| `lessons.controller.ts` (CRUD) | `INSTRUCTOR, ADMIN` ทุกเมธอด ยกเว้น `stream` ที่ไม่มี `@Roles` | ตรง — `stream` เปิดให้ทุก role ที่ login แล้ว แล้วกรองสิทธิ์จริงในเซอร์วิส (STUDENT ที่ลงทะเบียน/เจ้าของ/ADMIN) |
| `courses.controller.ts` | `INSTRUCTOR, ADMIN` สำหรับ mine/create/update/delete/submit/unpublish, `@Public()` สำหรับ list/detail | ตรง |

**ไม่พบ endpoint ที่ควรมี guard แต่ไม่มี** ในทุกโมดูลที่ตรวจ (courses/topups/enrollments/learn/quizzes/qna/reports/stats/uploads/materials/lessons/users/categories) — ทุกจุดที่ไม่มี `@Roles` ล้วนมีเหตุผลที่บันทึกเป็นคอมเมนต์ในไฟล์และมีการตรวจสิทธิ์จริงในชั้น service

---

## 6. DTO validation findings

**สรุป: ผ่านครบทุกจุดที่ตรวจ** — ไม่พบ `@Body() body: any`, `@Body() dto: any` หรือ query param แบบ `any` ที่ไหนเลย (grep `@Body\(\)\s+\w+\s*:\s*any|@Body\(\)\s+body\b|@Query\(\)\s+\w+\s*:\s*any` ทั้ง `backend/src` ไม่พบ)

- Global `ValidationPipe` ตั้งค่า `whitelist: true, forbidNonWhitelisted: true, transform: true` จริง (`backend/src/app.setup.ts:42-52`) — ตรงตาม CLAUDE.md §5 เป๊ะ
- ทุก controller ที่ตรวจ (`auth`, `topups`, `courses`, `quizzes`, `qna`, `users`, `categories`, `lessons`, `materials`, `enrollments`) ใช้ `@Body() dto: SomeDto` ที่มี `class-validator` decorator ครบ (ตัวอย่างที่ตรวจละเอียด: `course-request.dto.ts`, `quiz-request.dto.ts`, `topup-request.dto.ts`)
- เงินทุกจุดรับเป็น string ที่ตรวจด้วย regex `^\d{1,8}(\.\d{1,2})?$` ก่อนแปลงเป็น `Prisma.Decimal` ในเซอร์วิส (`course-request.dto.ts:20-21`, `topup-request.dto.ts:12-13`) — ไม่มีจุดไหนรับเงินเป็น `number` จาก client เลย
- Nested array (คำถามข้อสอบ/ตัวเลือก) ใช้ `@ValidateNested({each:true})` + `@Type(() => Dto)` ถูกต้อง (`quiz-request.dto.ts:44-49`)
- Query DTO แปลง string→number ด้วย `@Type(() => Number)` + `@IsInt()` + `@Min/@Max` ครบทุกจุด (pagination ของ topups/courses/reports)

**จุดเดียวที่ควรตรวจเพิ่มในรอบถัดไป (ไม่ใช่บั๊กที่ยืนยันได้ในรอบนี้)**: DTO ของ `reports`, `learn`, `enrollments`, `stats` ยังไม่ได้เปิดอ่านทีละไฟล์ครบ 100% (ตรวจแค่ import และ controller signature ว่าใช้ `@Body()/@Query() dto: SomeDto` ที่ถูกประเภทแล้ว) — ควรเปิด `report-request.dto.ts`, `progress-request.dto.ts` เพิ่มถ้าต้องการความมั่นใจระดับเดียวกับที่ตรวจ courses/quizzes/topups

---

## 7. Rate-limiting findings

ตรวจ `backend/src/config/throttler.config.ts`, `backend/src/modules/auth/auth.controller.ts`, `backend/src/modules/topups/topups.controller.ts`, `backend/src/modules/uploads/uploads.controller.ts`

| กติกา (PLAN.md เฟส 8 / CLAUDE.md §5) | ผลตรวจ | หลักฐาน |
|---|---|---|
| Login มี rate limit เฉพาะ | ผ่าน | `auth.controller.ts:47` `@RateLimit('login')` + `throttler.config.ts:32-37` bucket `login` แยกจาก default |
| Forgot-password มี rate limit เฉพาะ | ผ่าน | `auth.controller.ts:90` `@RateLimit('forgotPassword')` + `throttler.config.ts:38-43` |
| **สมัคร (register) มี rate limit เฉพาะ** | **ไม่ผ่าน** | `auth.controller.ts:36-44` ไม่มี `@RateLimit(...)` เลย มีแค่ throttler `default` (120 req/60s ต่อ IP, `throttler.config.ts:31`) คุ้มครองอยู่ ซึ่งกว้างกว่าที่ PLAN.md เฟส 8 ต้องการอย่างชัดเจน ("rate limit (login, สมัคร, ขอ QR, อัปโหลด)") |
| **ขอ QR PromptPay (`POST /topups/quote`) มี rate limit เฉพาะ** | **ไม่ผ่าน** | `topups.controller.ts:24-27` ไม่มี `@RateLimit(...)` เลย มีแค่ default bucket คุ้มครอง — endpoint นี้ไม่เขียน DB เลย (`topups.service.ts:119-121`) จึงเรียกซ้ำได้ไม่จำกัดในกรอบ 120 ครั้ง/นาที |
| **อัปโหลด (`POST /uploads/presign`) มี rate limit เฉพาะ** | **ไม่ผ่าน** | `uploads.controller.ts:16-23` ไม่มี `@RateLimit(...)` เลย เช่นเดียวกัน |

**สรุป**: ระบบมีแค่ 2 bucket ที่ตั้งใจ (`login`, `forgotPassword`) ตาม CLAUDE.md ที่บันทึกไว้ในหัวข้อ "สิ่งที่ตัดสินใจเพิ่มตอนทำระบบยืนยันตัวตน" — จุดนี้ CLAUDE.md ไม่ได้พูดเท็จ (ไม่เคยอ้างว่าทำ QR/upload rate limit) แต่ **PLAN.md เฟส 8 checklist ("ความปลอดภัย: rate limit (login, สมัคร, ขอ QR, อัปโหลด)") ยังไม่ผ่านจริงสำหรับ 3 ใน 4 รายการ** (สมัคร, ขอ QR, อัปโหลด) มีแค่ "default" 120 req/min/IP คุ้มครองทุก route รวมถึง 3 จุดนี้ด้วย — เป็นเกราะกว้างแต่ไม่ใช่ rate limit เฉพาะจุดตามที่ระบุไว้

---

## 8. เอกสารที่ล้าสมัย (CLAUDE.md/PLAN.md ไม่ตรงกับโค้ดจริง — ควรอัปเดต)

พบ 2 จุดที่ CLAUDE.md เขียนไว้ "ยังไม่ได้ทำ" แต่โค้ดจริงทำแล้ว (คนละทิศกับความเสี่ยงปกติที่เอกสารเกินจริง — ตรงนี้เอกสารด้อยกว่าความจริง ซึ่งดีกว่าแต่ก็ควรแก้ให้ตรง):

1. **"แก้ราคาคอร์สที่เผยแพร่แล้วต้องส่งอนุมัติใหม่"** — CLAUDE.md §8 หัวข้อเฟส 3 เขียนว่า "ยังไม่ได้ทำกติกา" นี้ แต่ `backend/src/modules/courses/courses.service.ts:270-284` ทำแล้วจริง: แก้ราคาคอร์สที่ `PUBLISHED` จะเซ็ต `status: PENDING_REVIEW` อัตโนมัติ ควรแก้ CLAUDE.md ให้ตรงกับโค้ด
2. **Decimal precision** — CLAUDE.md §5 เขียนว่าเงินทั้งหมดเป็น `Decimal(12,2)` แต่ schema จริงใช้ `Decimal(10,2)` สำหรับ `Course.price`/`Enrollment.pricePaid`/`TopupRequest.amount` (`schema.prisma:169,320,401`) และ `Decimal(14,2)` สำหรับ `Account.balance`/`LedgerEntry.amount` (`schema.prisma:434,476`) — ไม่ใช่บั๊กเชิงพฤติกรรม แต่ตัวเลขในเอกสารไม่ตรงกับโค้ด

---

## สรุปท้าย: punch list เรียงลำดับความสำคัญ

### Critical
*(ไม่พบรายการระดับ critical — ระบบบัญชีคู่, การล็อกแถว, DTO validation, และ ownership checks ทั้งหมดที่ตรวจผ่านเกณฑ์ของ CLAUDE.md ครบถ้วน ไม่พบช่องโหว่ด้านเงินหรือ IDOR ในโมดูลที่ตรวจ)*

### Important

1. **Rate limit ไม่ครอบคลุมตามที่ PLAN.md เฟส 8 กำหนด** — เพิ่ม `@RateLimit(...)` bucket ใหม่ (เช่น `register`, `topupQuote`, `uploadPresign`) ให้ `backend/src/modules/auth/auth.controller.ts:36` (register), `backend/src/modules/topups/topups.controller.ts:24` (`quote`), `backend/src/modules/uploads/uploads.controller.ts:17` (`presign`) แล้วประกาศ throttler ใหม่ใน `backend/src/config/throttler.config.ts:29-45`
2. **ไม่มี `GET /admin/users/:id`** — `backend/src/modules/users/admin-users.controller.ts:23-26` มีแค่ list ไม่มี detail เดี่ยว ถ้า `/admin/users/[id]` หน้า frontend (ตาม PLAN.md §3) จะถูกสร้างขึ้นในอนาคต endpoint นี้ต้องเพิ่มก่อน — ตอนนี้ทั้งสองฝั่งยังไม่มี จึงยังไม่ระเบิด แต่เป็นช่องว่างที่ควรอุดตอนทำหน้ารายละเอียดผู้ใช้
3. **ไม่มี `GET/PATCH /admin/settings` และไม่มี `PlatformSetting` model เลย** — grep ไม่เจอทั้งสองฝั่ง ค่าตั้งต้น (ส่วนแบ่งเริ่มต้น, PromptPay ID, ยอดถอนขั้นต่ำ) hardcode ผ่าน `.env`/`schema.prisma:91` แทน และ **ไม่มีบันทึกเหตุผลใน CLAUDE.md §8** — ควรตัดสินใจและบันทึกว่าจะทำ runtime settings หรือคงไว้แบบ `.env` ตลอดไป
4. **`Course` ไม่มี `slug`, ใช้ `:id` ในทุก route แทน `:slug`** — ต่างจาก PLAN.md §1.2/§2 ทั้งหมด (`GET /courses/:slug` ฯลฯ) และ**ไม่มีบันทึกเหตุผลใน CLAUDE.md §8** ว่าตั้งใจตัดทิ้ง ควรยืนยันว่าเป็นการตัดสินใจที่ตั้งใจ (URL คอร์สปัจจุบันเป็น cuid ที่อ่านไม่รู้เรื่อง ไม่เป็นมิตรกับ SEO) แล้วบันทึกไว้ หรือเพิ่ม slug ทีหลัง
5. **ไม่มี `GET /instructors/:id` (โปรไฟล์ผู้สอนสาธารณะ)** — PLAN.md §2 กำหนดไว้และ §3 ระบุว่าเป็นส่วนที่เหลือของเฟส 3 (`PLAN.md:466`) แต่ CLAUDE.md §8 ไม่เคยกล่าวถึงอีกเลยว่าทำหรือไม่ — grep ยืนยันว่ายังไม่ทำ ควรเพิ่มเข้า backlog เฟสถัดไปอย่างชัดเจน

### Nice-to-have

6. **`Category` ไม่มี `sortOrder`/`isActive`** — `schema.prisma:148-155` หมวดหมู่ทั้งหมดถือว่า active เสมอ ไม่มีการเรียงลำดับเอง ไม่กระทบการทำงาน แต่ต่างจาก PLAN.md §1.2 โดยไม่มีบันทึกเหตุผล
7. **`Course` ไม่มี `ratingAvg`/`ratingCount`/`enrollmentCount` เป็นคอลัมน์จริง** — `enrollmentCount` คำนวณสดด้วย `_count.enrollments` ทุกครั้ง (`courses.service.ts:46,180,213`) ซึ่งใช้งานได้แต่จะช้าลงเมื่อข้อมูลเยอะขึ้น (ตรงกับ R16 ใน PLAN.md) ส่วน `ratingAvg`/`ratingCount` รอ Review model ในเฟส 7
8. **แก้ CLAUDE.md ให้ตรงกับโค้ดจริง 2 จุด** (ดูหัวข้อ 8 ของรายงานนี้): (ก) กติกาส่งอนุมัติใหม่เมื่อแก้ราคาคอร์สที่เผยแพร่แล้ว ทำแล้วจริงที่ `courses.service.ts:270-284` ควรลบข้อความ "ยังไม่ได้ทำ" ออก (ข) ตัวเลข `Decimal(12,2)` ใน CLAUDE.md §5 ควรแก้เป็น `Decimal(10,2)`/`Decimal(14,2)` ให้ตรง schema จริง
9. **`GET /courses/:courseId/quizzes`, `GET /attempts/:id`, `PATCH /attempts/:id/answers` ใน PLAN.md ไม่มี endpoint แยกตรงๆ** — ทำงานผ่าน `GET /learn/:courseId/lessons/:lessonId` (คืน quiz มาในตัว) และ `GET /quizzes/:id/attempts/mine` (คืน `latestResult`) แทน เป็นการตัดสินใจสถาปัตยกรรมที่สมเหตุสมผลตาม CLAUDE.md แต่ไม่มีบรรทัดอธิบายตรงๆ ว่า endpoint เหล่านี้ของ PLAN.md ถูกแทนที่อย่างไร — เพิ่มบันทึกสั้นๆ ใน CLAUDE.md §8 จะช่วย session ถัดไปไม่ต้องไล่ grep หาเอง
10. **`GET /instructor/courses/:id/students` (รายชื่อผู้เรียนต่อคอร์ส) ไม่มี endpoint เลย และไม่มีบันทึกเหตุผล** — grep ไม่เจอทั้ง route และ service method ควรเพิ่มเข้า backlog หรือบันทึกว่าตัดออกเพราะเหตุใด

---

*จบรายงาน — ครอบคลุม entity coverage (27 entity ของ PLAN.md), endpoint coverage (~90 endpoint แบ่งตาม 13 โดเมน), frontend-backend contract (~70 จุดเรียก), money-transaction safety, RBAC/ownership, DTO validation, และ rate limiting ตามที่ระบุในโจทย์ทั้ง 7 ข้อ*
