# PLAN.md — getownly

แผนงานและขอบเขตของระบบ · อ่านคู่กับ [CLAUDE.md](CLAUDE.md)

**สถานะปัจจุบัน:** เฟส 1 เสร็จ · **เฟส 2 (ผู้ใช้ ยืนยันตัวตน สิทธิ์) เสร็จ** · **เฟส 3 (แคตตาล็อก สร้างคอร์ส สื่อการสอน) เสร็จ ยกเว้นคิวอนุมัติคอร์สของ ADMIN** · **เฟส 4 (กระเป๋าเงิน เติมเงิน QR PromptPay ตรวจสลิป) เสร็จ ยกเว้นอีเมลแจ้งผล** · **เฟส 5 เสร็จเฉพาะการซื้อคอร์สทีละคอร์ส — ยังไม่มีตะกร้าและ Order/OrderItem** · **เฟส 6 (ห้องเรียน ความคืบหน้า แบบทดสอบ) เสร็จ ยกเว้นใบประกาศนียบัตรและหน้าจอสร้างข้อสอบของผู้สอน** · **เฟส 7 เสร็จเฉพาะระบบถาม-ตอบ — ยังไม่มีรีวิว การถอนเงิน และการแจ้งเตือน** · **เฟส 8 (หลังบ้าน ADMIN · รายงานจากบัญชีคู่ · โปรไฟล์ · README · สคริปต์สาธิต) เสร็จ ยกเว้น Playwright e2e และการส่งออก CSV**

> **ลำดับการทำงานจริงต่างจากผังนี้** — งานที่เสี่ยงที่สุดคือระบบบัญชีคู่ จึงดึงขึ้นมาทำก่อน
> ตอนนี้วงจรเงินเดินครบรอบแล้ว: สร้าง QR PromptPay → แนบสลิป → ADMIN อนุมัติ → เงินเข้ากระเป๋า →
> ซื้อคอร์สโดยตัดจากกระเป๋า → เห็นคอร์สใน "คอร์สของฉัน" โดยทุกก้าวบันทึกลง ledger ที่ debit = credit
> ส่วนที่ยังขาดของเฟส 4–5 คือ **อีเมลแจ้งผลการตรวจสลิป · ตะกร้าสินค้า · Order/OrderItem (ซื้อหลายคอร์สในครั้งเดียว)**

> โครงสร้างฐานข้อมูลที่ลงมือทำจริงในเฟส 1 กระชับกว่ารายการ entity ในหัวข้อ 1 ของเอกสารนี้
> ดูสรุปความต่างและเหตุผลได้ที่หัวข้อ 8 ของ [CLAUDE.md](CLAUDE.md)
> รายการ entity ด้านล่างยังใช้เป็นเป้าหมายปลายทางของเฟส 5–7

---

## 0. ขอบเขตที่ตัดสินใจแล้ว

| ประเด็น | ข้อสรุป |
|---|---|
| การส่งวิดีโอ | เก็บ MP4 ใน MinIO แล้ว **proxy stream ผ่าน NestJS** รองรับ Range header ตรวจสิทธิ์ทุก request ไม่มี transcode ไม่มี HLS |
| ขอบเขตการเงิน | เติมเงิน → ซื้อ → **ผู้สอนขอถอนเงิน** (admin อนุมัติแล้วโอนจริงนอกระบบ) |
| ฟีเจอร์ผู้เรียน | ✅ รีวิว+ให้ดาว · ✅ ใบประกาศนียบัตร · ✅ แบบทดสอบมีเกณฑ์ผ่าน+สอบซ้ำ · ✅ ตะกร้าสินค้า |
| โครงสร้าง repo | pnpm workspace: `backend/` `frontend/` `packages/shared/` |

### นอกขอบเขต (ห้ามทำโดยไม่ถามก่อน)

- คืนเงินผู้เรียน (refund) และการยกเลิกคำสั่งซื้อหลังชำระแล้ว
- ต่อ payment gateway จริง / ตรวจสลิปอัตโนมัติด้วย OCR หรือ API ธนาคาร
- คูปองส่วนลด โปรโมชัน คอร์สแบบสมัครสมาชิกรายเดือน คอร์สชุด (bundle)
- ห้องเรียนสด สตรีมสด แชทเรียลไทม์
- แอปมือถือ · หลายภาษา (ไทยอย่างเดียว) · dark mode
- Redis, message queue, worker แยก, microservice
- ระบบ affiliate / ผู้ช่วยสอนหลายคนต่อคอร์ส (หนึ่งคอร์สมีเจ้าของคนเดียว)

---

## 1. Entity ทั้งหมด

> ยังไม่เขียน Prisma schema จริงในรอบนี้ — รายการนี้คือข้อตกลงเรื่องข้อมูลที่จะแปลงเป็น schema ในเฟส 1–2

### 1.1 ผู้ใช้และการยืนยันตัวตน

| Entity | ฟิลด์สำคัญ | ความสัมพันธ์ |
|---|---|---|
| **User** | email (unique), passwordHash, displayName, role (`STUDENT`\|`INSTRUCTOR`\|`ADMIN`), status (`ACTIVE`\|`SUSPENDED`), avatarKey, emailVerifiedAt, createdAt | 1–1 InstructorProfile · 1–1 Wallet · 1–n ทุกอย่างที่ตัวเองสร้าง |
| **InstructorProfile** | userId (unique), headline, bio, revenueSharePercent (nullable = ใช้ค่า default ของแพลตฟอร์ม), bankName, bankAccountNo, bankAccountName | 1–1 User |
| **RefreshToken** | userId, tokenHash (unique), expiresAt, revokedAt, replacedById, userAgent, ip | n–1 User |
| **AuthToken** | userId, type (`EMAIL_VERIFY`\|`PASSWORD_RESET`), tokenHash, expiresAt, usedAt | n–1 User |

หมายเหตุ: เลือกบทบาท STUDENT หรือ INSTRUCTOR ตอนสมัคร · ADMIN สร้างจาก seed เท่านั้น · การกันของเสียอยู่ที่ขั้นตอนอนุมัติคอร์ส ไม่ใช่การอนุมัติบัญชีผู้สอน

### 1.2 แคตตาล็อกและเนื้อหา

| Entity | ฟิลด์สำคัญ | ความสัมพันธ์ |
|---|---|---|
| **Category** | name, slug (unique), sortOrder, isActive | 1–n Course (หมวดหมู่ชั้นเดียว ไม่มีหมวดย่อย) |
| **Course** | instructorId, categoryId, title, slug (unique), subtitle, description, thumbnailKey, priceAmount `Decimal(12,2)`, level (`BEGINNER`\|`INTERMEDIATE`\|`ADVANCED`), status, submittedAt, approvedAt, approvedById, rejectionReason, publishedAt, ratingAvg, ratingCount, enrollmentCount | n–1 User(instructor) · n–1 Category · 1–n Section, Quiz, Enrollment, Review, QnaThread |
| **Section** | courseId, title, sortOrder | n–1 Course · 1–n Lesson |
| **Lesson** | sectionId, title, type (`VIDEO`\|`DOCUMENT`\|`TEXT`), sortOrder, isPreview, durationSeconds, contentText, videoAssetId | n–1 Section · n–1 MediaAsset · 1–n LessonAttachment, LessonProgress |
| **LessonAttachment** | lessonId, assetId, sortOrder | n–1 Lesson · n–1 MediaAsset |
| **MediaAsset** | ownerId, objectKey (unique), bucket, mimeType, sizeBytes, originalName, kind (`VIDEO`\|`DOCUMENT`\|`IMAGE`\|`SLIP`), status (`PENDING`\|`READY`) | n–1 User |

`Course.status`: `DRAFT` → `PENDING_REVIEW` → `PUBLISHED` / `REJECTED` และ `PUBLISHED` → `UNPUBLISHED`
กติกา: แก้เนื้อหาคอร์สที่ `PUBLISHED` ได้ทันที (ไม่ต้องอนุมัติซ้ำ) แต่ **แก้ราคาต้องส่งอนุมัติใหม่** · คอร์สที่มีคนซื้อแล้วห้ามลบ ทำได้แค่ `UNPUBLISHED`

### 1.3 แบบทดสอบ

| Entity | ฟิลด์สำคัญ | ความสัมพันธ์ |
|---|---|---|
| **Quiz** | courseId, sectionId (nullable = ข้อสอบท้ายคอร์ส), title, description, passingScorePercent `Decimal(5,2)`, maxAttempts (null = ไม่จำกัด), timeLimitMinutes (nullable), isRequiredForCompletion, isPublished | n–1 Course · 1–n QuizQuestion, QuizAttempt |
| **QuizQuestion** | quizId, sortOrder, text, type (`SINGLE_CHOICE`\|`MULTIPLE_CHOICE`\|`TRUE_FALSE`), points, explanation | n–1 Quiz · 1–n QuizChoice |
| **QuizChoice** | questionId, sortOrder, text, isCorrect | n–1 QuizQuestion |
| **QuizAttempt** | quizId, userId, attemptNo, startedAt, submittedAt, scorePercent `Decimal(5,2)`, earnedPoints, totalPoints, hasPassed, status (`IN_PROGRESS`\|`SUBMITTED`\|`EXPIRED`) | n–1 Quiz · n–1 User · 1–n QuizAnswer · unique(quizId, userId, attemptNo) |
| **QuizAnswer** | attemptId, questionId, selectedChoiceIds (`String[]`), isCorrect, earnedPoints | n–1 QuizAttempt · unique(attemptId, questionId) |

**ห้ามส่ง `isCorrect` ของ QuizChoice ออก API ตอนผู้เรียนกำลังทำข้อสอบ** — ส่งได้เฉพาะหน้าเฉลยหลังส่งคำตอบแล้ว

### 1.4 ตะกร้า คำสั่งซื้อ และการลงทะเบียน

| Entity | ฟิลด์สำคัญ | ความสัมพันธ์ |
|---|---|---|
| **CartItem** | userId, courseId, addedAt · unique(userId, courseId) | n–1 User · n–1 Course |
| **Order** | orderNo (unique), userId, status (`PAID`\|`FAILED`), totalAmount `Decimal(12,2)`, itemCount, placedAt, ledgerTransactionId | n–1 User · 1–n OrderItem |
| **OrderItem** | orderId, courseId, instructorId, **courseTitleSnapshot**, **priceAmount**, **revenueSharePercent**, **platformFeeAmount**, **instructorEarningAmount** | n–1 Order · n–1 Course · 1–1 Enrollment |
| **Enrollment** | userId, courseId, orderItemId, pricePaidAmount, enrolledAt, lastAccessedAt, progressPercent `Decimal(5,2)`, completedAt · unique(userId, courseId) | n–1 User · n–1 Course · 1–n LessonProgress · 1–1 Certificate |
| **LessonProgress** | enrollmentId, lessonId, watchedSeconds, isCompleted, completedAt · unique(enrollmentId, lessonId) | n–1 Enrollment · n–1 Lesson |
| **Certificate** | enrollmentId (unique), code (unique, ใช้ตรวจสอบสาธารณะ), **studentNameSnapshot**, **courseTitleSnapshot**, **instructorNameSnapshot**, issuedAt, pdfAssetKey | 1–1 Enrollment |

ชำระเงินตัดจาก wallet ทันที Order จึงมีแค่ `PAID` หรือ `FAILED` ไม่มีสถานะรอชำระ

### 1.5 กระเป๋าเงินและบัญชีคู่

| Entity | ฟิลด์สำคัญ | ความสัมพันธ์ |
|---|---|---|
| **Wallet** | userId (unique), balanceAmount `Decimal(12,2)`, updatedAt | 1–1 User (ยอดสรุป ไม่ใช่ความจริง — ledger คือความจริง) |
| **LedgerAccount** | code (unique), type (`ASSET`\|`LIABILITY`\|`REVENUE`), ownerUserId (nullable) | 1–n LedgerEntry |
| **LedgerTransaction** | type (`TOPUP`\|`PURCHASE`\|`PAYOUT`\|`ADJUSTMENT`), refType, refId, idempotencyKey (unique), memo, createdById, createdAt | 1–n LedgerEntry |
| **LedgerEntry** | transactionId, accountId, direction (`DEBIT`\|`CREDIT`), amount `Decimal(12,2)` | n–1 LedgerTransaction · n–1 LedgerAccount |
| **TopUpRequest** | userId, amount `Decimal(12,2)`, referenceCode (unique), qrPayload, slipAssetId, status, submittedAt, reviewedById, reviewedAt, rejectionReason, expiresAt, ledgerTransactionId | n–1 User · n–1 MediaAsset |
| **PayoutRequest** | instructorId, amount, **bankNameSnapshot / bankAccountNoSnapshot / bankAccountNameSnapshot**, status, requestedAt, reviewedById, reviewedAt, rejectionReason, transferSlipAssetId, ledgerTransactionId | n–1 User |

`TopUpRequest.status`: `AWAITING_SLIP` → `PENDING_REVIEW` → `APPROVED` / `REJECTED` (+ `EXPIRED`, `CANCELLED`)
`PayoutRequest.status`: `PENDING` → `APPROVED` / `REJECTED`

**ผังบัญชีและรายการเดินบัญชี**

| ธุรกรรม | DEBIT | CREDIT |
|---|---|---|
| อนุมัติเติมเงิน `A` | `PLATFORM_CASH` `A` | `USER_WALLET:<student>` `A` |
| ซื้อคอร์ส รวม `T` (แต่ละรายการ ราคา `P` = รายได้ผู้สอน `E` + ค่าธรรมเนียม `F`) | `USER_WALLET:<student>` `T` | `INSTRUCTOR_PAYABLE:<instructor>` `E` (ต่อรายการ) และ `PLATFORM_REVENUE` `ΣF` |
| อนุมัติถอนเงิน `A` | `INSTRUCTOR_PAYABLE:<instructor>` `A` | `PLATFORM_CASH` `A` |

- ยอดคงเหลือ: บัญชี ASSET = Σdebit − Σcredit · บัญชี LIABILITY/REVENUE = Σcredit − Σdebit
- **ยอดที่ผู้สอนถอนได้ = ยอด `INSTRUCTOR_PAYABLE` − ผลรวมคำขอถอนที่สถานะ `PENDING`** (คำขอถอนไม่แตะ ledger จนกว่าจะอนุมัติ)

### 1.6 ชุมชนและระบบ

| Entity | ฟิลด์สำคัญ | ความสัมพันธ์ |
|---|---|---|
| **Review** | courseId, userId, rating (1–5), comment, status (`VISIBLE`\|`HIDDEN`), createdAt, updatedAt · unique(courseId, userId) | n–1 Course · n–1 User (ต้องลงทะเบียนคอร์สแล้วจึงรีวิวได้) |
| **QnaThread** | courseId, lessonId (nullable), userId, title, body, status (`OPEN`\|`ANSWERED`\|`CLOSED`), replyCount, lastReplyAt | n–1 Course · 1–n QnaReply |
| **QnaReply** | threadId, userId, body, isInstructorReply, createdAt | n–1 QnaThread · n–1 User |
| **Notification** | userId, type, title, body, linkUrl, readAt, createdAt | n–1 User |
| **PlatformSetting** | key (unique), value `Json`, updatedById, updatedAt | — (เก็บ default revenue share, PromptPay ID, ชื่อผู้รับ, ยอดถอนขั้นต่ำ) |
| **AuditLog** | actorId, action, entityType, entityId, metadata `Json`, ip, createdAt | n–1 User (บันทึกทุกการกระทำของ ADMIN ที่มีผลกับเงินหรือสถานะบัญชี) |

**รวม 27 entity**

### 1.7 ภาพรวมความสัมพันธ์

```
User ─┬─ InstructorProfile (1:1)
      ├─ Wallet (1:1)
      ├─ Course* ──┬─ Section* ── Lesson* ─┬─ MediaAsset (video)
      │            │                        └─ LessonAttachment* ── MediaAsset
      │            ├─ Quiz* ── QuizQuestion* ── QuizChoice*
      │            ├─ Review*
      │            └─ QnaThread* ── QnaReply*
      ├─ CartItem*
      ├─ Order* ── OrderItem* ─── Enrollment (1:1) ─┬─ LessonProgress*
      │                    │                         └─ Certificate (1:1)
      │                    └── (snapshot ราคา + ส่วนแบ่ง)
      ├─ QuizAttempt* ── QuizAnswer*
      ├─ TopUpRequest*  ┐
      └─ PayoutRequest* ┴── LedgerTransaction ── LedgerEntry* ── LedgerAccount
```

---

## 2. API endpoints

Base path: `/api` · สิทธิ์ `—` = สาธารณะ · ทุก endpoint ที่ไม่ระบุ `—` ต้อง login
ทุกรายการที่มีเครื่องหมาย 💰 ต้องอยู่ใน `prisma.$transaction` และบันทึก ledger

### auth
| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| POST | `/auth/register` | — | เลือก role STUDENT หรือ INSTRUCTOR · ส่งอีเมลยืนยัน |
| POST | `/auth/login` | — | ตั้ง httpOnly cookie สองใบ · บัญชี SUSPENDED เข้าไม่ได้ |
| POST | `/auth/refresh` | — (ใช้ refresh cookie) | หมุน token ทุกครั้ง |
| POST | `/auth/logout` | ทุกบทบาท | เพิกถอน refresh token |
| GET | `/auth/me` | ทุกบทบาท | ข้อมูลผู้ใช้ปัจจุบัน + ยอด wallet |
| POST | `/auth/verify-email` | — | |
| POST | `/auth/resend-verification` | — | rate limit |
| POST | `/auth/forgot-password` | — | ตอบเหมือนกันเสมอ ไม่บอกว่าอีเมลมีจริงไหม |
| POST | `/auth/reset-password` | — | เพิกถอน refresh token ทั้งหมดหลังรีเซ็ต |

### users
| Method | Path | สิทธิ์ |
|---|---|---|
| PATCH | `/users/me` | ทุกบทบาท |
| PATCH | `/users/me/password` | ทุกบทบาท |
| PATCH | `/users/me/avatar` | ทุกบทบาท |
| GET | `/users/me/instructor-profile` | INSTRUCTOR |
| PATCH | `/users/me/instructor-profile` | INSTRUCTOR (bio, headline, ข้อมูลบัญชีธนาคาร) |

### categories
| Method | Path | สิทธิ์ |
|---|---|---|
| GET | `/categories` | — |
| POST / PATCH / DELETE | `/admin/categories[/:id]` | ADMIN (ลบไม่ได้ถ้ามีคอร์สอยู่) |

### catalog (สาธารณะ)
| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/courses` | — | ค้นหา + กรอง: `q`, `categoryId`, `level`, `minPrice`, `maxPrice`, `minRating`, `sort` (ใหม่สุด/ขายดี/คะแนน/ราคา), `page`, `pageSize` |
| GET | `/courses/:slug` | — | เฉพาะคอร์ส PUBLISHED (เจ้าของและ ADMIN ดูสถานะอื่นได้) |
| GET | `/courses/:slug/curriculum` | — | ชื่อบทเรียน + ระยะเวลา + ธง preview เท่านั้น |
| GET | `/courses/:id/reviews` | — | แบ่งหน้า + สรุปการกระจายคะแนน |
| GET | `/instructors/:id` | — | โปรไฟล์ผู้สอน + คอร์สที่เผยแพร่ |
| GET | `/certificates/:code` | — | หน้าตรวจสอบใบประกาศ |

### instructor — คอร์สและเนื้อหา
| Method | Path | สิทธิ์ |
|---|---|---|
| GET/POST | `/instructor/courses` | INSTRUCTOR |
| GET/PATCH | `/instructor/courses/:id` | INSTRUCTOR (เจ้าของ) |
| DELETE | `/instructor/courses/:id` | INSTRUCTOR (เฉพาะ DRAFT ที่ยังไม่มีคนซื้อ) |
| POST | `/instructor/courses/:id/submit` | INSTRUCTOR (ต้องมี ≥1 บทเรียน + ราคา + thumbnail) |
| POST | `/instructor/courses/:id/unpublish` | INSTRUCTOR |
| POST/PATCH/DELETE | `/instructor/courses/:id/sections[/:sectionId]` | INSTRUCTOR |
| PATCH | `/instructor/courses/:id/sections/reorder` | INSTRUCTOR |
| POST/PATCH/DELETE | `/instructor/sections/:id/lessons[/:lessonId]` | INSTRUCTOR |
| PATCH | `/instructor/sections/:id/lessons/reorder` | INSTRUCTOR |
| GET/POST/PATCH/DELETE | `/instructor/courses/:id/quizzes[/:quizId]` | INSTRUCTOR |
| POST/PATCH/DELETE | `/instructor/quizzes/:id/questions[/:questionId]` | INSTRUCTOR |
| GET | `/instructor/courses/:id/students` | INSTRUCTOR |

### media
| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| POST | `/media/presign-upload` | ทุกบทบาท | ตรวจ kind, mimeType, sizeBytes ก่อนออก URL |
| POST | `/media/:id/complete` | ทุกบทบาท | ยืนยันว่าอัปโหลดสำเร็จ → status READY |
| GET | `/lessons/:id/stream` | STUDENT ที่ลงทะเบียน / เจ้าของคอร์ส / ADMIN | **proxy stream + Range** ไม่ใช่ redirect |
| GET | `/lessons/:id/attachments/:assetId` | เหมือนข้างบน | presigned GET อายุ 5 นาที |

### wallet และเติมเงิน
| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/wallet` | ทุกบทบาท | ยอดคงเหลือ |
| GET | `/wallet/transactions` | ทุกบทบาท | รายการเดินบัญชีของตัวเอง (อ่านจาก ledger) |
| POST | `/wallet/topups` | STUDENT, INSTRUCTOR | สร้างคำขอ + gen QR PromptPay + referenceCode |
| GET | `/wallet/topups` `/wallet/topups/:id` | เจ้าของคำขอ | |
| POST | `/wallet/topups/:id/slip` | เจ้าของคำขอ | แนบสลิป → PENDING_REVIEW |
| POST | `/wallet/topups/:id/cancel` | เจ้าของคำขอ | เฉพาะที่ยังไม่ตรวจ |

### ตะกร้าและคำสั่งซื้อ
| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/cart` | STUDENT | ราคาคำนวณสดจาก DB เสมอ |
| POST | `/cart/items` | STUDENT | กันเพิ่มคอร์สที่ซื้อไปแล้ว / คอร์สตัวเอง |
| DELETE | `/cart/items/:courseId` · `/cart` | STUDENT | |
| POST | `/orders/checkout` 💰 | STUDENT | ตัด wallet + สร้าง Order/OrderItem(snapshot) + Enrollment + ledger ใน transaction เดียว |
| GET | `/orders` · `/orders/:id` | เจ้าของ | |

### การเรียน
| Method | Path | สิทธิ์ |
|---|---|---|
| GET | `/me/enrollments` | STUDENT |
| GET | `/me/enrollments/:courseId` | STUDENT (ลงทะเบียนแล้ว) — curriculum + ความคืบหน้า |
| POST | `/lessons/:id/progress` | STUDENT (ลงทะเบียนแล้ว) — บันทึกวินาทีที่ดู |
| POST | `/lessons/:id/complete` | STUDENT — คำนวณ progressPercent ใหม่ |
| GET | `/me/enrollments/:courseId/certificate` | STUDENT — ออกใบเมื่อครบเงื่อนไข |

### แบบทดสอบ (ฝั่งผู้เรียน)
| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/courses/:courseId/quizzes` | ลงทะเบียนแล้ว | |
| GET | `/quizzes/:id` | ลงทะเบียนแล้ว | ไม่มีเฉลย |
| POST | `/quizzes/:id/attempts` | ลงทะเบียนแล้ว | ตรวจ maxAttempts |
| PATCH | `/attempts/:id/answers` | เจ้าของ attempt | บันทึกคำตอบระหว่างทำ |
| POST | `/attempts/:id/submit` | เจ้าของ attempt | ตรวจให้คะแนน + ตัดสินผ่าน/ไม่ผ่าน |
| GET | `/attempts/:id` | เจ้าของ attempt / เจ้าของคอร์ส | ดูเฉลยได้หลัง submit |
| GET | `/quizzes/:id/attempts` | เจ้าของ | ประวัติการสอบทุกครั้ง |

### รีวิว
| Method | Path | สิทธิ์ |
|---|---|---|
| POST | `/courses/:id/reviews` | STUDENT (ลงทะเบียนแล้ว, 1 คน 1 รีวิว) |
| PATCH / DELETE | `/reviews/:id` | เจ้าของรีวิว |

### ถาม–ตอบ
| Method | Path | สิทธิ์ |
|---|---|---|
| GET | `/courses/:id/qna` | ลงทะเบียนแล้ว / เจ้าของคอร์ส |
| POST | `/courses/:id/qna` | STUDENT (ลงทะเบียนแล้ว) |
| GET | `/qna/:threadId` | ผู้ที่เกี่ยวข้อง |
| POST | `/qna/:threadId/replies` | ผู้ถาม / เจ้าของคอร์ส |
| PATCH | `/qna/:threadId/status` | เจ้าของคอร์ส |
| GET | `/instructor/qna` | INSTRUCTOR — กล่องคำถามรวมทุกคอร์ส |

### รายได้และการถอนเงินของผู้สอน
| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/instructor/sales` | INSTRUCTOR | ยอดขายรายรายการ + กรองช่วงวันที่ |
| GET | `/instructor/earnings` | INSTRUCTOR | รายได้สุทธิ, ยอดคงค้าง, ยอดถอนได้, ยอดถอนแล้ว |
| GET/POST | `/instructor/payouts` | INSTRUCTOR | ขอถอน (ตรวจยอดถอนได้ + ยอดขั้นต่ำ + ต้องมีข้อมูลบัญชี) |
| GET | `/instructor/payouts/:id` | เจ้าของคำขอ | |

### admin
| Method | Path | หมายเหตุ |
|---|---|---|
| GET | `/admin/topups?status=` | คิวตรวจสลิป |
| GET | `/admin/topups/:id` | ดูสลิป (presigned อายุสั้น) + ประวัติผู้ใช้ |
| POST | `/admin/topups/:id/approve` 💰 | เข้ากระเป๋า + ledger + แจ้งเตือน |
| POST | `/admin/topups/:id/reject` | ต้องระบุเหตุผล |
| GET | `/admin/courses?status=` | คิวอนุมัติคอร์ส |
| POST | `/admin/courses/:id/approve` · `/reject` | reject ต้องระบุเหตุผล |
| GET | `/admin/users` · `/admin/users/:id` | ค้นหา + กรองบทบาท/สถานะ |
| PATCH | `/admin/users/:id/status` | ระงับ/คืนสถานะบัญชี |
| PATCH | `/admin/users/:id/revenue-share` | ตั้งอัตราส่วนแบ่งรายบุคคล |
| GET | `/admin/payouts?status=` | คิวคำขอถอน |
| POST | `/admin/payouts/:id/approve` 💰 | แนบสลิปโอน + ledger |
| POST | `/admin/payouts/:id/reject` | |
| PATCH | `/admin/reviews/:id/status` | ซ่อนรีวิวไม่เหมาะสม |
| GET | `/admin/reports/overview` | ผู้ใช้ · คอร์ส · ยอดขาย · รายได้แพลตฟอร์ม |
| GET | `/admin/reports/sales` | ยอดขายตามช่วงเวลา/หมวด/ผู้สอน |
| GET | `/admin/reports/ledger` | งบทดลอง — **ต้องพิสูจน์ว่า Σdebit = Σcredit** |
| GET/PATCH | `/admin/settings` | ส่วนแบ่งเริ่มต้น, PromptPay ID, ยอดถอนขั้นต่ำ |
| GET | `/admin/audit-logs` | |

### notifications
| Method | Path | สิทธิ์ |
|---|---|---|
| GET | `/notifications` · POST `/notifications/:id/read` · POST `/notifications/read-all` | ทุกบทบาท |

---

## 3. หน้าจอ frontend

### (public)
| Route | หน้าจอ |
|---|---|
| `/` | หน้าแรก — คอร์สแนะนำ หมวดหมู่ คอร์สขายดี |
| `/courses` | ค้นหาคอร์ส + ตัวกรองด้านซ้าย + แบ่งหน้า |
| `/courses/[slug]` | รายละเอียดคอร์ส — หลักสูตร ผู้สอน รีวิว ปุ่มซื้อ/เข้าเรียน ดูตัวอย่างฟรี |
| `/categories/[slug]` | คอร์สในหมวดหมู่ |
| `/instructors/[id]` | โปรไฟล์ผู้สอนสาธารณะ |
| `/certificates/[code]` | ตรวจสอบใบประกาศนียบัตร |
| `/about` `/terms` `/privacy` | หน้าเนื้อหาคงที่ |

### (auth)
`/login` · `/register` · `/verify-email` · `/forgot-password` · `/reset-password`

### (student)
| Route | หน้าจอ |
|---|---|
| `/dashboard` | ภาพรวม — เรียนต่อ ความคืบหน้า ยอดกระเป๋า |
| `/my-courses` | คอร์สที่ซื้อแล้ว + แถบความคืบหน้า |
| `/learn/[courseId]` | เปลี่ยนทางไปบทเรียนล่าสุด |
| `/learn/[courseId]/lessons/[lessonId]` | **หน้าเล่นบทเรียน** — วิดีโอ + สารบัญข้าง + เอกสารแนบ + แท็บถาม-ตอบ |
| `/learn/[courseId]/quizzes/[quizId]` | ทำแบบทดสอบ |
| `/learn/[courseId]/quizzes/[quizId]/attempts/[attemptId]` | ผลสอบ + เฉลย |
| `/learn/[courseId]/certificate` | ใบประกาศนียบัตร (ดู/ดาวน์โหลด PDF) |
| `/cart` | ตะกร้าสินค้า |
| `/checkout` | ยืนยันคำสั่งซื้อ + ยอดกระเป๋าคงเหลือ + ปุ่มไปเติมเงินถ้าไม่พอ |
| `/orders` · `/orders/[id]` | ประวัติคำสั่งซื้อ |
| `/wallet` | ยอดคงเหลือ + รายการเดินบัญชี |
| `/wallet/topup` | กรอกจำนวนเงิน → สร้างคำขอ |
| `/wallet/topup/[id]` | **แสดง QR PromptPay + รหัสอ้างอิง + อัปโหลดสลิป + สถานะการตรวจสอบ** |
| `/settings/profile` · `/settings/security` | จัดการบัญชี |
| `/notifications` | การแจ้งเตือน |

### (instructor)
| Route | หน้าจอ |
|---|---|
| `/instructor` | ภาพรวม — ยอดขาย ผู้เรียนใหม่ คำถามค้าง คอร์สรออนุมัติ |
| `/instructor/courses` | คอร์สทั้งหมด + สถานะ |
| `/instructor/courses/new` | สร้างคอร์สใหม่ |
| `/instructor/courses/[id]` | แก้ไขข้อมูลคอร์ส (แท็บ: ข้อมูลทั่วไป · ราคา · เผยแพร่) |
| `/instructor/courses/[id]/curriculum` | **จัดการบท/บทเรียน + อัปโหลดวิดีโอและเอกสาร + จัดลำดับ** |
| `/instructor/courses/[id]/quizzes` · `/[quizId]` | จัดการแบบทดสอบและข้อสอบ |
| `/instructor/courses/[id]/students` | รายชื่อผู้เรียน + ความคืบหน้า |
| `/instructor/qna` | กล่องคำถามรวมทุกคอร์ส |
| `/instructor/sales` | รายงานยอดขาย |
| `/instructor/earnings` | รายได้หลังหักส่วนแบ่ง + ยอดถอนได้ |
| `/instructor/payouts` · `/instructor/payouts/new` | คำขอถอนเงิน |
| `/instructor/settings` | โปรไฟล์ผู้สอน + ข้อมูลบัญชีธนาคาร |

### (admin)
| Route | หน้าจอ |
|---|---|
| `/admin` | แดชบอร์ดภาพรวม + จำนวนงานค้างในแต่ละคิว |
| `/admin/topups` · `/admin/topups/[id]` | **คิวตรวจสลิป — ดูสลิปคู่กับจำนวนเงินและรหัสอ้างอิง แล้วอนุมัติ/ปฏิเสธ** |
| `/admin/courses` · `/admin/courses/[id]` | คิวอนุมัติคอร์ส (ดูเนื้อหาได้ก่อนอนุมัติ) |
| `/admin/users` · `/admin/users/[id]` | จัดการผู้ใช้ ระงับบัญชี ตั้งอัตราส่วนแบ่งรายบุคคล |
| `/admin/payouts` · `/admin/payouts/[id]` | คิวคำขอถอนเงิน + แนบสลิปโอน |
| `/admin/categories` | จัดการหมวดหมู่ |
| `/admin/reviews` | ตรวจรีวิวที่ถูกรายงาน |
| `/admin/reports` | รายงานภาพรวม ยอดขาย และงบทดลอง |
| `/admin/settings` | ตั้งค่าแพลตฟอร์ม |
| `/admin/audit-logs` | บันทึกการกระทำของผู้ดูแล |

**รวม ~50 หน้า** · แต่ละ route group มี `layout.tsx` ของตัวเอง (public = header/footer, student = header + เมนู, instructor/admin = sidebar สี `primary`)

---

## 4. แผนงาน 8 เฟส

> กติกา: **ห้ามขึ้นเฟสถัดไปจนกว่าเกณฑ์ตรวจรับของเฟสปัจจุบันจะผ่านครบทุกข้อ**
> ทุกเฟสต้องผ่าน `pnpm typecheck` และ `pnpm lint` เป็นเงื่อนไขพื้นฐาน

---

### เฟส 1 — วางรากฐานและสภาพแวดล้อม

**ทำอะไร**
- ตั้ง pnpm workspace + `packages/shared` (enum + response type)
- `docker-compose.yml`: postgres 16, minio, mailhog + `.env.example` + config validation ของ env ตอน boot
- โครง NestJS: global ValidationPipe, exception filter รูปแบบเดียว, PrismaService, StorageService (MinIO), MailService, `/health`
- โครง Next.js: App Router, route groups ทั้ง 5, ฟอนต์ IBM Plex Sans Thai, **design token ครบทุกค่าใน `@theme`**, shadcn/ui, layout เปล่าของแต่ละ group
- API client ฝั่ง frontend (แนบ cookie, จัดการ error รูปแบบมาตรฐาน)
- Vitest + สคริปต์ทั้งหมดใน root `package.json`

**ได้อะไร** — สภาพแวดล้อมที่ยกด้วยคำสั่งเดียวและมีหน้าเว็บเปล่าที่ใช้ token จริง

**ตรวจสอบว่าเสร็จ**
- [ ] เครื่องเปล่า: `pnpm install && pnpm docker:up && pnpm dev` แล้วใช้งานได้ไม่ต้องแก้อะไรมือ
- [ ] `GET /api/health` ตอบ ok และรายงานว่าเชื่อม postgres + minio ได้จริง
- [ ] หน้าแรกแสดงผลด้วยฟอนต์ IBM Plex Sans Thai และสี `primary`/`secondary` ถูกต้อง
- [ ] ยิง endpoint ทดสอบด้วย payload ผิด → ได้ error รูปแบบมาตรฐาน `{ statusCode, code, message }` พร้อมข้อความไทย
- [ ] `pnpm test` รันผ่าน (แม้ยังมีเทสต์น้อย)

---

### เฟส 2 — ผู้ใช้ การยืนยันตัวตน และสิทธิ์

**ทำอะไร**
- Prisma schema ชุดแรก: User, InstructorProfile, RefreshToken, AuthToken, Wallet (สร้างพร้อม user), PlatformSetting, AuditLog, Category
- สมัคร/เข้าสู่ระบบ/ออกจากระบบ/refresh rotation/ยืนยันอีเมล/ลืมรหัสผ่าน (argon2, cookie httpOnly)
- `JwtAuthGuard` + `RolesGuard` + `@Public()` + `@CurrentUser()` + `@Roles()`
- middleware ของ Next.js กันเส้นทางตามบทบาท + หน้า login/register/ตั้งค่าบัญชี
- ADMIN: รายชื่อผู้ใช้ ระงับบัญชี ตั้งอัตราส่วนแบ่งรายบุคคล จัดการหมวดหมู่ + AuditLog
- seed: admin 1, instructor 2, student 2, หมวดหมู่ 6–8, ค่าตั้งต้นแพลตฟอร์ม

**ได้อะไร** — ระบบล็อกอิน 3 บทบาทที่ใช้งานได้จริงพร้อมหลังบ้านจัดการผู้ใช้

**ตรวจสอบว่าเสร็จ**
- [x] สมัคร → ล็อกอินได้ · ลืมรหัสผ่าน → รับอีเมลใน Mailhog → ตั้งรหัสใหม่ → ล็อกอินด้วยรหัสใหม่ได้
- [x] access token หมดอายุแล้วเรียก API ต่อ → API client หมุน refresh ให้อัตโนมัติแล้วยิงซ้ำ โดยผู้ใช้ไม่รู้สึก
- [x] ใช้ refresh token ใบเดิมซ้ำครั้งที่สอง → ถูกปฏิเสธ และ session ทั้งชุดของผู้ใช้นั้นถูก revoke
- [x] STUDENT เรียก endpoint ของ ADMIN → 403 (`RolesGuard` + เทสต์ครอบ ยังไม่มี endpoint ของ ADMIN จริงจนถึงเฟส 3)
- [x] ADMIN ระงับบัญชี → ผู้ใช้นั้นล็อกอินไม่ได้ และ access token เดิมใช้ต่อไม่ได้ทันที
- [x] API response ไม่มี `passwordHash` หรือ token หลุดออกมาเลย (มีเทสต์ครอบ)

> ยังไม่ได้ทำในเฟสนี้: ยืนยันอีเมลตอนสมัคร · หน้าจัดการผู้ใช้ของ ADMIN · ตั้งอัตราส่วนแบ่งรายบุคคล ·
> จัดการหมวดหมู่ · `AuditLog` · `PlatformSetting` — ย้ายไปทำพร้อมหน้าหลังบ้านในเฟส 3
>
> โครงสร้างจริงต่างจากรายการด้านบน: ไม่มี `InstructorProfile` / `AuthToken` / `Wallet` แยก
> (ใช้ `User.commissionRate` และ `Account` kind `USER_WALLET` แทน) ดูเหตุผลใน CLAUDE.md หัวข้อ 8

---

### เฟส 3 — แคตตาล็อก การสร้างคอร์ส และสื่อการสอน

**ทำอะไร**
- Prisma: Course, Section, Lesson, MediaAsset, LessonAttachment
- CRUD คอร์ส/บท/บทเรียน + จัดลำดับ + ตรวจความเป็นเจ้าของทุกจุด
- อัปโหลด: presigned PUT + ตรวจ mimeType/ขนาด + `/media/:id/complete`
- **สตรีมวิดีโอ proxy ผ่าน NestJS รองรับ Range header** + ตรวจสิทธิ์ (preview เท่านั้นสำหรับคนที่ยังไม่ซื้อ)
- flow ส่งอนุมัติ: DRAFT → PENDING_REVIEW → PUBLISHED/REJECTED + คิวอนุมัติของ ADMIN
- หน้าสาธารณะ: ค้นหาคอร์ส · รายละเอียดคอร์ส · หน้าโปรไฟล์ผู้สอน
- หน้าผู้สอน: จัดการคอร์สและหลักสูตร + อัปโหลดพร้อมแถบความคืบหน้า

**ได้อะไร** — ผู้สอนสร้างคอร์สจริงได้ ADMIN อนุมัติได้ และคนทั่วไปเห็นคอร์สในหน้าค้นหา

**ตรวจสอบว่าเสร็จ**
- [x] ผู้สอนสร้างคอร์ส อัปโหลดวิดีโอ 1 ไฟล์ + PDF 1 ไฟล์ ส่งอนุมัติ → `PENDING_REVIEW`
      (**ขั้นตอน ADMIN อนุมัติยังไม่ได้ทำ** ดูหมายเหตุท้ายเฟส)
- [x] ผู้สอน A แก้คอร์สของผู้สอน B → 403 (มีเทสต์ครอบ)
- [x] เรียก `/lessons/:id/stream` โดยไม่ได้ล็อกอิน → 401 · ล็อกอินแต่ไม่ได้ซื้อและบทเรียนไม่ใช่ preview → 403
- [x] เลื่อนแถบเวลาในวิดีโอกลางเรื่อง → เล่นต่อได้ทันที (Range ทำงานจริง ตอบ 206 + `Content-Range` ถูกต้อง)
- [x] คอร์สที่ยัง DRAFT/PENDING_REVIEW ไม่ปรากฏใน `/courses` และเข้า URL ตรงได้ 404 (เจ้าของและ ADMIN ยังเข้าได้)
- [x] ค้นหาด้วยคำไทย + กรองหมวดหมู่/ราคา ได้ผลถูกต้อง
      (ยังไม่มีตัวกรอง `level` เพราะ schema จริงไม่มีคอลัมน์นี้ ดู CLAUDE.md หัวข้อ 8)

> ที่เหลือของเฟสนี้: **คิวอนุมัติคอร์สของ ADMIN** (`GET /admin/courses`, `POST /admin/courses/:id/approve|reject`)
> และหน้า `/admin/courses` · หน้าโปรไฟล์ผู้สอนสาธารณะ `/instructors/:id`

---

### เฟส 4 — กระเป๋าเงิน เติมเงิน และแกนบัญชีคู่ ⚠️ เฟสที่เสี่ยงที่สุด

**ทำอะไร**
- Prisma: LedgerAccount, LedgerTransaction, LedgerEntry, TopUpRequest
- `LedgerService` เป็นทางเดียวที่เขียน ledger ได้ — ตรวจ Σdebit = Σcredit ก่อน commit เสมอ, idempotencyKey, ล็อกแถวด้วย `FOR UPDATE`
- สร้างคำขอเติมเงิน → gen **QR PromptPay ระบุจำนวนเงิน** (มาตรฐาน EMVCo) + รหัสอ้างอิงไม่ซ้ำ + วันหมดอายุ
- อัปโหลดสลิป → คิวตรวจของ ADMIN → อนุมัติ (เข้ากระเป๋า + ledger) / ปฏิเสธพร้อมเหตุผล
- หน้า `/wallet`, `/wallet/topup`, `/wallet/topup/[id]`, `/admin/topups`
- อีเมล/แจ้งเตือนเมื่อผลการตรวจออก

**ได้อะไร** — เงินเข้าระบบได้จริงผ่านการตรวจของ ADMIN พร้อมบัญชีคู่ที่ตรวจสอบย้อนหลังได้

**ตรวจสอบว่าเสร็จ**
- [~] QR ที่ระบบสร้าง สแกนด้วยแอปธนาคารจริงแล้วขึ้นชื่อผู้รับและจำนวนเงินถูกต้อง
      **ยังไม่ได้ทดสอบกับแอปธนาคารจริง** เพราะ `PROMPTPAY_ID` เป็นเลข 0 ทั้งหมดโดยตั้งใจ
      สิ่งที่พิสูจน์แล้ว: payload เป็นรูปแบบ EMVCo ถูกต้อง (tag 54 = จำนวนเงินตรงเป๊ะ) และ
      **CRC ท้าย payload ตรงกับที่คำนวณด้วย CRC-16/CCITT-FALSE แยกต่างหาก** ซึ่งเป็นเงื่อนไขที่เครื่องสแกนใช้ตัดสิน
      จะติ๊กข้อนี้ได้ต้องใส่เลขพร้อมเพย์จริงใน `backend/.env` แล้วสแกนด้วยมือ
- [x] อนุมัติเติมเงิน 500 → wallet เพิ่ม 500 และเกิด ledger entry 2 แถวที่ debit = credit
- [x] กดปุ่มอนุมัติรัวๆ / ยิง API ซ้ำ 10 ครั้งพร้อมกัน → เงินเข้าครั้งเดียว (มีเทสต์ครอบ)
- [x] ปฏิเสธสลิป → ยอดไม่ขยับและมี ledger entry ศูนย์รายการ
- [x] เทสต์: จงใจสร้าง entry ที่ debit ≠ credit → service ต้อง throw และ rollback ทั้ง transaction
- [x] `SUM(debit) = SUM(credit)` ทั้งตารางหลังรันเทสต์ทั้งชุด
- [x] `Account.balance` ของทุกบัญชี = ยอดที่คำนวณจาก ledger เป๊ะ (`computeBalance` + `assertLedgerInvariants`)
- [x] อัปโหลดสลิปจริงขึ้น MinIO ผ่าน presigned PUT แล้วสร้างคำขอ → ADMIN เห็นในคิวพร้อมรูปสลิปและข้อมูลผู้โอน
- [x] หน้า `/wallet` `/wallet/topup` `/admin/topups` ใช้งานได้จริงจากเบราว์เซอร์

> ที่เหลือของเฟสนี้: **อีเมลแจ้งผลการตรวจสลิป** (ตอนนี้ผู้ใช้เห็นผลจากตารางประวัติในหน้า `/wallet/topup` เท่านั้น)

---

### เฟส 5 — ตะกร้า ชำระเงิน และการลงทะเบียนเรียน

**ทำอะไร**
- Prisma: CartItem, Order, OrderItem, Enrollment
- ตะกร้า: เพิ่ม/ลบ/ล้าง + กันคอร์สซ้ำ กันคอร์สที่ซื้อแล้ว กันคอร์สของตัวเอง
- `checkout` ใน `prisma.$transaction` เดียว: ล็อก wallet → ตรวจยอด → คำนวณส่วนแบ่งต่อรายการ → สร้าง Order + OrderItem **พร้อม snapshot ราคา/ส่วนแบ่ง/ค่าธรรมเนียม/รายได้** → สร้าง Enrollment → บันทึก ledger → ล้างตะกร้า
- อัตราส่วนแบ่ง: ใช้ `InstructorProfile.revenueSharePercent` ถ้ามี ไม่งั้นใช้ค่า default จาก PlatformSetting
- หน้า `/cart`, `/checkout`, `/orders`, `/orders/[id]`, `/my-courses`

**ได้อะไร** — วงจรเงินครบรอบ: เติม → ซื้อ → ได้สิทธิ์เรียน โดยรายได้ผู้สอนตั้งค้างในระบบ

**ตรวจสอบว่าเสร็จ**
- [ ] ซื้อ 3 คอร์สจากผู้สอน 2 คนในครั้งเดียว → เกิด Enrollment 3 รายการ · ledger entry ครบทุกฝั่ง · debit = credit
      **ยังทำไม่ได้ เพราะยังไม่มีตะกร้า** ตอนนี้ซื้อได้ทีละคอร์สผ่าน `POST /courses/:id/purchase`
      (ซื้อทีละคอร์ส 3 ครั้งได้ผลถูกต้องและ ledger สมดุล แต่ไม่ใช่รายการเดียวตามที่ข้อนี้ต้องการ)
- [x] ยอดเงินไม่พอ → `INSUFFICIENT_WALLET_BALANCE` และไม่มีอะไรถูกสร้างเลย (คืน 422 ไม่ใช่ 400 ดูเหตุผลใน CLAUDE.md หัวข้อ 8)
- [x] กดปุ่มซื้อสองครั้งพร้อมกัน → ลงทะเบียนรายการเดียว ไม่ถูกตัดเงินซ้ำ (มีเทสต์ครอบ)
- [x] ซื้อคอร์สราคา 1000 ที่ส่วนแบ่ง 30% → รายได้ผู้สอน 700.00 · แพลตฟอร์ม 300.00 · ผลรวมเท่าราคาพอดีไม่มีเศษหาย
- [x] เปลี่ยนราคาคอร์สและอัตราส่วนแบ่งหลังการซื้อ → รายการเดิมและรายงานย้อนหลังไม่เปลี่ยนค่า
- [x] ซื้อคอร์สเดิมซ้ำ → ถูกปฏิเสธ
- [x] เทสต์ราคาเศษ (999.99×30% · 333.33×15% · 1234.56×25% · 0.01×30%) ไม่มีเงินหายหรือเกิน
- [x] หน้ารายละเอียดคอร์ส: เงินพอ → ปุ่ม "ซื้อคอร์สนี้" · เงินไม่พอ → "เติมเงินเพื่อซื้อ" พร้อมบอกว่าขาดอีกเท่าไร
- [x] หน้า `/my-courses` แสดงคอร์สที่ซื้อแล้วพร้อมแถบความคืบหน้า

> ที่เหลือของเฟสนี้: **ตะกร้าสินค้า · Order/OrderItem (ซื้อหลายคอร์สในครั้งเดียว) · หน้า `/cart` `/checkout` `/orders`**
> ตอนนี้ `Enrollment` เก็บ snapshot ราคาและอัตราส่วนแบ่งเอง จึงยังไม่ต้องมี Order/OrderItem จนกว่าจะทำตะกร้า

---

### เฟส 6 — ประสบการณ์การเรียน แบบทดสอบ และใบประกาศ

**ทำอะไร**
- Prisma: LessonProgress, Quiz, QuizQuestion, QuizChoice, QuizAttempt, QuizAnswer, Certificate
- หน้าเล่นบทเรียน: วิดีโอ + สารบัญ + เอกสารแนบ + ทำเครื่องหมายเรียนจบ + จำตำแหน่งที่ดูค้างไว้ + คำนวณ progressPercent
- ผู้สอนสร้างแบบทดสอบ: ปรนัยเลือกตอบเดียว/หลายตอบ/ถูก-ผิด + คะแนนผ่าน + จำกัดจำนวนครั้ง + จับเวลา (ไม่บังคับ)
- ผู้เรียนทำข้อสอบ: เริ่ม → บันทึกคำตอบ → ส่ง → ตรวจอัตโนมัติ → แสดงผลและเฉลย → สอบซ้ำได้ตามโควตา
- ใบประกาศ: ออกเมื่อเรียนครบทุกบทเรียน + ผ่านแบบทดสอบที่บังคับทุกชุด → gen PDF พร้อม snapshot ชื่อ + รหัสตรวจสอบสาธารณะ

**ได้อะไร** — ผู้เรียนเรียนจบคอร์สได้ครบวงจรและได้ใบประกาศที่ตรวจสอบได้

**ตรวจสอบว่าเสร็จ**
- [x] ดูวิดีโอค้างไว้ ปิดเบราว์เซอร์ กลับมาใหม่ → เล่นต่อจากจุดเดิม
      (`PATCH /progress/:lessonId` ทุก 10 วินาที + ตอนกดหยุดและตอนออกจากหน้า ·
      ผู้เล่นกระโดดไปที่ `lastPositionSec` ตอน `loadedmetadata` · มีเทสต์ครอบฝั่ง API)
- [x] เรียนครบทุกบทเรียน → progressPercent = 100
- [x] API ตอนกำลังทำข้อสอบ **ไม่มี `isCorrect` ติดออกไปเลย** (มีเทสต์ครอบ ตรวจทั้ง payload ไม่ใช่แค่ชื่อฟิลด์)
- [—] ทำข้อสอบครบตามโควตาแล้วขอเริ่มใหม่ → ถูกปฏิเสธ
      **ไม่มีโควตาโดยตั้งใจ** รอบนี้กำหนดกติกาว่า "ทำซ้ำได้ไม่จำกัด เก็บทุกครั้ง แสดงคะแนนสูงสุด"
      schema จริงจึงไม่มี `maxAttempts` (ต่างจากหัวข้อ 1.3 ของเอกสารนี้)
- [x] คะแนนถึงเกณฑ์ → `hasPassed = true` · ต่ำกว่าเกณฑ์ → false และสอบซ้ำได้ทันที
- [ ] เรียนไม่ครบหรือสอบไม่ผ่าน → ขอใบประกาศไม่ได้
- [ ] `/certificates/[code]` เปิดจากเครื่องที่ไม่ได้ล็อกอินแล้วตรวจสอบได้จริง
- [ ] เปลี่ยนชื่อผู้ใช้หลังออกใบประกาศ → ชื่อในใบเดิมไม่เปลี่ยน

> ที่เหลือของเฟสนี้: **ใบประกาศนียบัตรทั้งหมด** (model `Certificate` · การออกใบ · หน้า `/certificates/[code]`)
> และ **หน้าจอให้ผู้สอนสร้างและแก้ไขข้อสอบ** — ฝั่ง API ทำครบแล้ว
> (`POST /lessons/:id/quiz` · `PATCH|DELETE /quizzes/:id`) แต่ยังไม่มีหน้าจอเรียกใช้
> ตอนนี้แบบทดสอบที่เห็นบนเว็บมาจาก `prisma/seed.ts` ซึ่งสร้างไว้ให้แล้ว 7 ชุด

---

### เฟส 7 — ชุมชน รายได้ผู้สอน และการถอนเงิน

**ทำอะไร**
- Prisma: Review, QnaThread, QnaReply, PayoutRequest, Notification
- รีวิว: ให้ดาว 1–5 + คอมเมนต์ (เฉพาะผู้ที่ซื้อแล้ว 1 คน 1 รีวิว) + อัปเดต `ratingAvg`/`ratingCount` ของคอร์ส + ADMIN ซ่อนรีวิวได้
- ถาม–ตอบ: ผู้เรียนตั้งคำถามผูกกับคอร์ส/บทเรียน · ผู้สอนตอบ · สถานะกระทู้ · กล่องคำถามรวมของผู้สอน
- รายงานยอดขายและรายได้ของผู้สอน (อ่านจาก snapshot ทั้งหมด)
- ถอนเงิน: ผู้สอนขอถอน (ตรวจยอดถอนได้ + ยอดขั้นต่ำ) → ADMIN อนุมัติพร้อมแนบสลิปโอน → ledger `INSTRUCTOR_PAYABLE` → `PLATFORM_CASH`
- ระบบแจ้งเตือนในเว็บ + อีเมลสำหรับเหตุการณ์สำคัญ (สลิปได้รับการอนุมัติ/ปฏิเสธ, คอร์สได้รับอนุมัติ, มีคนซื้อคอร์ส, มีคำถามใหม่, ผลการถอนเงิน)

**ได้อะไร** — ผู้สอนเห็นรายได้จริงและถอนออกได้ ผู้เรียนมีช่องทางสื่อสารและรีวิว

**ตรวจสอบว่าเสร็จ**
- [ ] คนที่ยังไม่ซื้อคอร์ส → รีวิวไม่ได้ · คนที่ซื้อแล้วรีวิวซ้ำครั้งที่สอง → ถูกปฏิเสธ (แก้ของเดิมได้)
- [ ] เพิ่ม/ลบรีวิว → `ratingAvg` และ `ratingCount` ของคอร์สถูกต้องเสมอ
- [~] ผู้เรียนถาม → ผู้สอนได้รับแจ้งเตือนและตอบได้ → สถานะกระทู้เปลี่ยนเป็น ANSWERED
      **ตอบได้แล้ว** ผ่านกล่องคำถาม `/instructor/qna` ที่รวมคำถามค้างของทุกคอร์ส
      และกระทู้ที่ผู้สอนตอบแล้วขึ้นป้าย "ผู้สอนตอบแล้ว" สีเขียว
      **แต่ยังไม่มีการแจ้งเตือน** — ผู้สอนต้องเปิดกล่องคำถามเอง (ยังไม่มี model `Notification`)
- [x] คนที่ไม่ได้ลงทะเบียนคอร์ส อ่านกระทู้ถาม-ตอบของคอร์สนั้นไม่ได้ (`QNA_ACCESS_DENIED` มีเทสต์ครอบ)
- [ ] ยอดถอนได้ = `INSTRUCTOR_PAYABLE` − คำขอที่ยัง PENDING (มีเทสต์ครอบ)
- [ ] ขอถอนเกินยอดที่ถอนได้ → ถูกปฏิเสธ · ขอถอนซ้อนสองใบรวมกันเกินยอด → ใบที่สองถูกปฏิเสธ
- [ ] ADMIN อนุมัติการถอน → `INSTRUCTOR_PAYABLE` ลดลงเท่ายอดที่ถอน และ debit = credit ยังคงจริง
- [ ] รายงานรายได้ของผู้สอน = ผลรวม `instructorEarningAmount` จาก OrderItem เป๊ะ

> ที่ทำแล้วในเฟสนี้: **ระบบถาม-ตอบทั้งหมด** (`QnaThread` `QnaReply` มีใน schema ตั้งแต่เฟส 1 จึงไม่ต้อง migrate)
> 7 endpoint · หน้า `/learn/[courseId]/qna` · `/learn/[courseId]/qna/[threadId]` · `/instructor/qna`
>
> ที่เหลือของเฟสนี้: **รีวิวและให้ดาว · รายงานยอดขายและรายได้ของผู้สอน · การถอนเงิน (`PayoutRequest` + `TxType.PAYOUT`) ·
> ระบบแจ้งเตือนในเว็บและอีเมล (`Notification`)** — ทั้งหมดยังไม่มี model ใน schema จึงต้อง migrate เมื่อลงมือ

---

### เฟส 8 — รายงานผู้ดูแล ขัดเกลา และทดสอบระบบ

**ทำอะไร**
- แดชบอร์ดและรายงานของ ADMIN: ภาพรวม · ยอดขายตามช่วงเวลา/หมวด/ผู้สอน · **งบทดลองพิสูจน์ debit = credit** · ส่งออก CSV
- ขัดเกลา UI ทั้งระบบ: empty state ทุกหน้า · skeleton ตอนโหลด · หน้า 404/500 · responsive มือถือ · ตรวจข้อความไทยตกหล่นทุกหน้า
- ความปลอดภัย: rate limit (login, สมัคร, ขอ QR, อัปโหลด) · helmet · CORS เข้มงวด · จำกัดขนาด payload · ตรวจ IDOR ทุก endpoint อีกรอบ
- Playwright e2e ครอบ 5 เส้นทางหลัก
- seed ชุดสาธิตสำหรับวันนำเสนอ (ผู้ใช้ครบ 3 บทบาท คอร์สหลายสถานะ ธุรกรรมย้อนหลัง)
- README: วิธีติดตั้ง · สถาปัตยกรรม · ER diagram · คำอธิบาย ledger · ข้อจำกัดที่ทราบ

**ได้อะไร** — ระบบพร้อมสาธิตและพร้อมส่งเป็นปริญญานิพนธ์

**ตรวจสอบว่าเสร็จ**
- [—] e2e ผ่านครบ 5 เส้นทาง
      **ยังไม่ได้ทำ Playwright** แต่ 4 ใน 5 เส้นทางถูกครอบด้วยการยิง API จริงแทน
      (เฟส 6 ผ่าน 19 ข้อ · เฟส 7 ผ่าน 29 ข้อ · เฟส 8 ผ่าน 45 ข้อ) เหลือเฉพาะเส้นทางใบประกาศที่ยังไม่มีฟีเจอร์
- [~] หน้างบทดลองแสดง Σdebit = Σcredit และตัวเลขตรงกับรายงานยอดขาย
      **ยังไม่มีหน้างบทดลองแยกต่างหาก** แต่ความสมดุลถูกพิสูจน์ 3 ที่:
      `assertLedgerInvariants` ท้ายเทสต์ที่แตะเงินทุกข้อ · `demo-seed.ts` ตรวจก่อนจบทุกครั้ง ·
      และเทสต์ที่พิสูจน์ว่า **ผลรวมรายได้ผู้สอนทุกคน = ยอดค้างจ่ายที่ ADMIN เห็น** เป๊ะถึงสตางค์
- [x] ทุกหน้ามี empty state และสถานะกำลังโหลด ไม่มีหน้าจอขาวเปล่า (ไล่ตรวจครบทุก view component)
- [ ] เปิดทุกหน้าบนจอ 375px แล้วใช้งานได้ ไม่มีเนื้อหาล้นขอบ
      **ยังไม่ได้ทดสอบด้วยตาจริง** ตารางทุกใบใส่ `overflow-x-auto` ไว้แล้ว แต่ต้องเปิดดูเองอีกรอบ
- [x] ไล่ทุกหน้าแล้วไม่พบข้อความภาษาอังกฤษหลุด
      สแกนอัตโนมัติทั้ง JSX text node และ prop ที่ผู้ใช้เห็น เหลือเฉพาะชื่อเฉพาะและหน่วยเทคนิค
      (`getownly` · `slug` · `MB` · `%`) ซึ่งข้อห้าม 19 ยกเว้นไว้
- [x] `pnpm build` ผ่านทั้ง backend และ frontend · `pnpm test` ผ่านทั้งหมด (252 ข้อ)
- [ ] ติดตั้งจาก README บนเครื่องเปล่าตามขั้นตอนแล้วใช้งานได้จริง
      **ยังไม่ได้ลองบนเครื่องเปล่า** README เขียนครบทุกขั้นตอนแล้วแต่ต้องมีคนลองจริงอีกที

> ที่ทำแล้วในเฟสนี้: **จัดการผู้ใช้ · คิวอนุมัติคอร์ส · CRUD หมวดหมู่ · รายงาน 5 endpoint ·
> หน้าโปรไฟล์ทุกบทบาท · README ฉบับสมบูรณ์ · `pnpm demo:reset`**
>
> ที่เหลือของเฟสนี้: **Playwright e2e · ส่งออก CSV · หน้างบทดลองแยก · `AuditLog` ·
> ตรวจ responsive บนจอ 375px ด้วยตา**

---

## 5. ความเสี่ยงและจุดที่ต้องระวัง

### ความเสี่ยงสูง

| # | ความเสี่ยง | ผลกระทบ | วิธีรับมือ |
|---|---|---|---|
| R1 | **ยอดเงินเพี้ยน** จาก race condition ตอนซื้อ/เติมเงินพร้อมกัน | เงินหายหรืองอกในระบบ กู้ยากมาก | ล็อกแถว wallet ด้วย `FOR UPDATE` ทุกครั้ง · `idempotencyKey` unique · เทสต์ยิงพร้อมกัน 10 request ทุกเส้นทางที่แตะเงิน |
| R2 | **อนุมัติสลิปซ้ำ** เพราะ ADMIN กดรัวหรือเปิดสองแท็บ | เงินเข้าซ้ำ | เช็คสถานะภายใน transaction เดียวกับการเขียน ledger · unique constraint บน `TopUpRequest.ledgerTransactionId` · ปุ่มปิดตัวเองหลังกด |
| R3 | **ปัดเศษทศนิยมทำเงินหาย** ตอนแบ่งส่วนแบ่ง | รายงานไม่ลงตัว กรรมการจับได้ | คำนวณค่าธรรมเนียมก่อน แล้ว **รายได้ผู้สอน = ราคา − ค่าธรรมเนียม** เสมอ · Decimal ล้วน · เทสต์กรณีเศษ |
| R4 | **ไม่ snapshot ราคา/ส่วนแบ่ง** แล้วแก้ทีหลัง | รายงานย้อนหลังเพี้ยนทั้งระบบ ตรวจไม่พบจนสาย | บังคับ snapshot ใน OrderItem ตั้งแต่เฟส 5 · เทสต์ที่แก้ราคาแล้วเช็คว่าคำสั่งซื้อเดิมไม่เปลี่ยน |
| R5 | **สลิปปลอม** — ระบบไม่มีทางตรวจสอบอัตโนมัติ | เงินปลอมเข้าระบบ | ยอมรับเป็นข้อจำกัดที่ประกาศไว้ · ลดความเสี่ยงด้วยรหัสอ้างอิงต่อคำขอ + QR ระบุจำนวนเงินตายตัว + แสดงประวัติผู้ใช้ให้ ADMIN ดูประกอบ + AuditLog ทุกการอนุมัติ · **เขียนไว้ในบทข้อจำกัดของเล่มด้วย** |

### ความเสี่ยงกลาง

| # | ความเสี่ยง | วิธีรับมือ |
|---|---|---|
| R6 | Proxy stream วิดีโอผ่าน NestJS กิน bandwidth/หน่วยความจำ ถ้าดูพร้อมกันหลายคน | ใช้ stream แบบ pipe ห้ามโหลดทั้งไฟล์ลง buffer · รองรับ Range ให้ถูกต้อง · จำกัดขนาดไฟล์อัปโหลด · ยอมรับข้อจำกัดด้านจำนวนผู้ใช้พร้อมกันและระบุในเล่ม |
| R7 | อัปโหลดวิดีโอไฟล์ใหญ่ล้มกลางทาง ทิ้งไฟล์ขยะใน MinIO | สถานะ MediaAsset `PENDING`/`READY` · สคริปต์เก็บกวาดไฟล์ที่ค้าง PENDING เกิน 24 ชม. |
| R8 | ตรวจสิทธิ์แค่ระดับบทบาท ลืมตรวจความเป็นเจ้าของ (IDOR) | ตรวจ 2 ชั้นเสมอ · เขียนเทสต์ "ผู้ใช้ A แตะของผู้ใช้ B" ทุกโมดูลตั้งแต่เฟส 3 |
| R9 | `Wallet.balanceAmount` ค่อยๆ เพี้ยนจาก ledger | สคริปต์ตรวจความสอดคล้องที่รันได้ทุกเมื่อ + รันในเทสต์ท้ายชุดทุกครั้ง |
| R10 | ขอบเขตบานปลาย (อยากได้แชท สตรีมสด คูปอง) | รายการ out of scope ในหัวข้อ 0 คือสัญญา · เพิ่มอะไรต้องถามก่อนเสมอ |
| R11 | เขียนโค้ดจนหมดเวลาแล้วเทสต์ยังว่าง | ทุกเฟสต้องมีเทสต์ของตัวเองก่อนขึ้นเฟสถัดไป โดยเฉพาะเฟส 4–5 ที่ห้ามข้าม |
| R12 | ข้อความไทยตกหล่นเป็นอังกฤษในหน้าจอ | รวมข้อความไว้ที่ `lib/messages` · ไล่ตรวจทุกหน้าในเฟส 8 |

### ความเสี่ยงต่ำแต่ต้องรู้ไว้

| # | ความเสี่ยง | วิธีรับมือ |
|---|---|---|
| R13 | Tailwind v4 + shadcn/ui ยังมีจุดที่เอกสารไม่ตรงกัน | ตั้งค่า token ให้จบตั้งแต่เฟส 1 แล้วไม่แตะอีก |
| R14 | สร้าง QR PromptPay ผิดมาตรฐาน แอปธนาคารสแกนไม่ขึ้น | ทดสอบกับแอปธนาคารจริงตั้งแต่วันแรกของเฟส 4 (เป็นเกณฑ์ตรวจรับข้อแรก) |
| R15 | อีเมลเข้า spam ตอนขึ้น production | dev ใช้ Mailhog · ระบุใน README ว่าต้องต่อ SMTP จริงเมื่อขึ้นใช้งาน |
| R16 | ค้นหาคำไทยด้วย `LIKE` ช้าเมื่อข้อมูลเยอะ | ข้อมูลระดับปริญญานิพนธ์ยังพอไหว · ใส่ index บน title/slug/categoryId · ถ้าช้าค่อยพิจารณา full-text ของ Postgres |
| R17 | ผู้สอนลบบทเรียนที่มีคนเรียนไปแล้ว ทำให้ progress เพี้ยน | ห้ามลบถาวร ใช้ soft delete หรือบล็อกไว้ถ้ามี LessonProgress แล้ว · คำนวณ progress จากบทเรียนที่ยังใช้งานอยู่เท่านั้น |

---

## 6. ลำดับความสำคัญถ้าเวลาไม่พอ

1. **ห้ามตัด** — เฟส 1–5 (สมัคร ล็อกอิน สร้างคอร์ส เติมเงิน ซื้อ เรียน) คือแกนของหัวข้อปริญญานิพนธ์
2. **ตัดได้บางส่วน** — เฟส 6: ใบประกาศตัดออกได้ แต่ต้องเหลือแบบทดสอบ
3. **ตัดได้** — เฟส 7: ถาม–ตอบ กับ แจ้งเตือนทางอีเมล ตัดได้ แต่ **การถอนเงินและรีวิวควรเหลือไว้**
4. **ลดได้** — เฟส 8: e2e ลดเหลือ 3 เส้นทางหลัก แต่ **หน้างบทดลองห้ามตัด** เพราะเป็นหลักฐานว่าระบบบัญชีคู่ทำงานจริง
