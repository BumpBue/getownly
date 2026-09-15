# SCOPE_UPDATE_AUDIT.md — ตรวจสอบขอบเขตอัปเดต 2.3.1–2.3.4

เอกสารนี้เป็นผลตรวจสอบรอบที่ 1 เท่านั้น **ยังไม่มีการแก้โค้ดใดๆ** ทั้งหมดด้านล่างมาจากการไล่อ่านโค้ดจริงในสาขา `master` ณ วันที่ 2026-09-01

สถานะที่ใช้ตลอดเอกสาร:
- 🔴 **ยังไม่มีเลย** — ต้องสร้างใหม่ทั้งหมด
- 🟡 **มีบางส่วนแต่ไม่ตรงขอบเขตใหม่** — ต้องแก้ค่า/แก้ตรรกะ
- 🟢 **มีและตรงอยู่แล้ว** — ไม่ต้องแก้

---

## 1. ราคาคอร์สต้องไม่เกิน 10,000 บาท — 🔴 ยังไม่มีเลย

**ไฟล์ที่เกี่ยวข้อง**
- `backend/prisma/schema.prisma:157-169` — `Course.price` เป็น `Decimal @default(0) @db.Decimal(10,2)` (หมายเหตุ: ชื่อฟิลด์เป็น `price` ไม่ใช่ `priceAmount` ตามกติกาการตั้งชื่อในหัวข้อ 5 ของ CLAUDE.md — เป็นปัญหาเดิมที่มีอยู่ก่อน ไม่ใช่สิ่งที่ต้องแก้ในรอบนี้ แต่บันทึกไว้เผื่อทำความสะอาดทีหลัง)
- `backend/src/modules/courses/dto/course-request.dto.ts:20` — `PRICE_PATTERN = /^\d{1,8}(\.\d{1,2})?$/` ใช้ทั้งใน `CreateCourseDto.price` (บรรทัด 41-44) และ `UpdateCourseDto.price` (บรรทัด 70-73)
- `frontend/src/lib/catalog/schemas.ts:14,16-29` — zod schema `courseFormSchema` ใช้ pattern เดียวกัน มีคอมเมนต์กำกับว่าต้องตรงกับฝั่ง backend เสมอ
- ใช้ใน `frontend/src/app/(instructor)/instructor/courses/new/page.tsx` และ `.../[id]/GeneralTab.tsx`

**สถานะปัจจุบัน**
ไม่มีเพดานราคาเลยทั้งระบบ มีแค่การตรวจ "รูปแบบ" ตัวเลข (ไม่เกิน 8 หลักเต็ม + 2 ทศนิยม = ได้สูงสุด 99,999,999.99) ไม่มี `@Max` ที่ backend และไม่มี `.max()` ที่ zod schema ฝั่ง frontend CLAUDE.md และ PLAN.md ก็ไม่มีข้อความพูดถึงเพดานราคาไว้เลย

**สิ่งที่ต้องทำ**
- เพิ่มการตรวจ ≤ 10,000 ที่ `CreateCourseDto.price` และ `UpdateCourseDto.price` (ราคาเป็น string ตาม pattern เดิม จึงต้องแปลงเป็นตัวเลขเพื่อเทียบ เช่น custom validator หรือ `@Transform` + `@Max` — ระวังไม่ให้กลายเป็น `number` ไปคำนวณจริง ใช้เทียบค่าเท่านั้น)
- เพิ่ม `.refine()` หรือ `.max()` เทียบเชิงตัวเลขที่ `courseFormSchema` ฝั่ง frontend ให้ตรงกับ backend
- ข้อความ error ภาษาไทยระบุตัวเลขชัดเจน เช่น "ราคาคอร์สต้องไม่เกิน 10,000 บาท"
- อัปเดตคอมเมนต์ที่บอกว่า pattern "ต้องตรงกับฝั่ง backend เสมอ" ให้ครอบคลุมเพดานใหม่ด้วย

---

## 2. พื้นที่จัดเก็บต่อคอร์สไม่เกิน 3 GB (วิดีโอ+เอกสารรวมกัน) — 🔴 ยังไม่มีเลย

**ไฟล์ที่เกี่ยวข้อง**
- `backend/prisma/schema.prisma` — `Course` (บรรทัด 157-187) ไม่มีฟิลด์เก็บผลรวมขนาดไฟล์ใดๆ · ไม่มีโมเดล `MediaAsset` เลย · วิดีโออยู่ที่ `Lesson.videoKey` (บรรทัด 196, `String?`) **ไม่มีฟิลด์เก็บขนาดไฟล์วิดีโอเลย** (มีแค่ `durationSec`) · เอกสารอยู่ที่ `Material` (บรรทัด 212-224) ซึ่งมี `fileSize Int` ต่อแถว แต่ไม่เคยถูกรวมยอด
- `backend/src/modules/uploads/uploads.service.ts:67-93` (`presignUpload()`) — ตรวจแค่ role + MIME→นามสกุล + ขนาดไฟล์ *รายไฟล์* เทียบกับ `UPLOAD_RULES` ไม่มี `courseId` ใน `PresignUploadDto` เลย จึงเช็คภาพรวมต่อคอร์สไม่ได้ตั้งแต่ต้นทาง
- `backend/src/modules/uploads/upload-rules.ts:39-84` — ตารางเพดานเป็นรายไฟล์ (`UPLOAD_MAX_VIDEO_MB=500`, `UPLOAD_MAX_DOCUMENT_MB=50`, `UPLOAD_MAX_IMAGE_MB=5` ใน `.env.example` และ `env.validation.ts`) ไม่มีเพดานรวมต่อคอร์ส
- `backend/src/modules/materials/materials.service.ts:44-92` (`create()`) — ตรวจขนาดจริงด้วย `storage.stat()` แต่เทียบกับเพดานรายไฟล์เท่านั้น
- `backend/src/modules/lessons/lessons.service.ts:95-143` — ตั้งค่า `videoKey` โดยไม่มีการ `stat()` หรือบันทึกขนาดไฟล์เลย
- Frontend: ไม่พบแถบพื้นที่ใช้ไป/คงเหลือใน `instructor/courses/[id]/` เลย

**สถานะปัจจุบัน**
ไม่มีการคำนวณหรือจำกัดพื้นที่รวมต่อคอร์สเลยแม้แต่แบบ SUM สดๆ (ไม่ใช่แค่ "มีแต่ช้า") ยิ่งไปกว่านั้น **ขนาดไฟล์วิดีโอไม่เคยถูกบันทึกไว้เลย** ต้องเพิ่ม pipeline การบันทึกขนาดไฟล์วิดีโอก่อนถึงจะรวมยอดได้

**สิ่งที่ต้องทำ**
- Migration: เพิ่ม `Course.storageUsedBytes` (แนะนำ `BigInt @default(0)`) เป็นยอดสะสมแบบ cached ตามที่โจทย์ระบุ
- เพิ่มการบันทึกขนาดไฟล์วิดีโอจริงตอนอัปโหลดเสร็จ (ปัจจุบันไม่มี — ต้องเพิ่ม `stat()` เหมือนที่ `materials.service.ts` ทำกับเอกสาร)
- ทุกจุดที่เพิ่ม/ลบ `Material` หรือวิดีโอของ `Lesson` ต้องอัปเดต `Course.storageUsedBytes` แบบ atomic ในธุรกรรมเดียวกับการเขียนแถวนั้น (บวก/ลบ ไม่ใช่ SUM ใหม่ทุกครั้ง — ตรงกับข้อกำหนด performance)
- เพิ่ม `courseId` เข้า `PresignUploadDto` (หรือ derive จาก lesson/material context) เพื่อให้ `presignUpload()` เช็คยอดสะสม + ขนาดไฟล์ใหม่ ก่อนออก URL ถ้าเกิน 3GB ให้ปฏิเสธพร้อมข้อความไทยบอกพื้นที่คงเหลือ (เช่น "พื้นที่จัดเก็บคงเหลือ 250 MB จากทั้งหมด 3 GB")
- Frontend: เพิ่มแถบแสดงพื้นที่ใช้ไป/คงเหลือที่หน้าแก้ไขคอร์ส (ดึงจาก `storageUsedBytes` ที่ backend คืนมา ไม่คำนวณเองฝั่ง client)
- ต้องตัดสินใจ: การลบไฟล์ (material/video) จะลดยอด `storageUsedBytes` ทันทีไหม แม้ MinIO ลบแบบ best-effort ตามกติกาเดิมของเฟส 3 (ควรลดยอดในฐานข้อมูลทันทีไม่ต้องรอ MinIO เพื่อไม่ให้ยอดค้าง)

---

## 3. เกณฑ์คะแนนผ่านแบบทดสอบ (passScore) ต้อง 50–100% — 🟡 มีบางส่วนแต่ค่าไม่ตรง

**ไฟล์ที่เกี่ยวข้อง**
- `backend/prisma/schema.prisma:234-248` — `Quiz.passScore Int` (ชื่อจริงคือ `passScore` ไม่ใช่ `passingScorePercent` ตามที่ PLAN.md หัวข้อ 1.3 เขียนไว้ — เป็นความต่างเดิมที่มีอยู่แล้ว) คอมเมนต์ในสคีมาเขียนว่า "0-100" ซึ่งต้องแก้เป็น "50-100"
- `backend/src/modules/quizzes/dto/quiz-request.dto.ts:58-63` (`CreateQuizDto`) และ `:80-85` (`UpdateQuizDto`) — ปัจจุบัน `@IsInt() @Min(1) @Max(100)` มีข้อความไทยกำกับอยู่แล้ว
- ไม่พบ UI สร้าง/แก้แบบทดสอบฝั่งผู้สอนเลย — `frontend/src/app/(instructor)/instructor/courses/[id]/page.tsx:23,248-252` แท็บ "แบบทดสอบ" ยังเป็น empty state ("หน้าจัดการแบบทดสอบยังไม่เปิดใช้งาน") ตรงตามที่ CLAUDE.md หัวข้อ 8 บันทึกไว้ — **ยังเป็นจริงอยู่ ไม่มีอะไรเปลี่ยน**

**สถานะปัจจุบัน**
Validation มีอยู่แล้วที่ backend แต่พื้นล่างผิด (1 แทนที่จะเป็น 50) ส่วน "frontend form ของหน้าสร้าง/แก้ไขแบบทดสอบ" ตามที่โจทย์รอบ 2 ข้อ 4 ระบุ **ยังไม่มีอยู่จริงในระบบ** เพราะทั้งหน้าจอสร้างแบบทดสอบของผู้สอนยังไม่ถูกสร้าง (ค้างจากเฟส 6)

**สิ่งที่ต้องทำ**
- แก้ `@Min(1, ...)` เป็น `@Min(50, ...)` ที่ทั้ง `CreateQuizDto` และ `UpdateQuizDto` พร้อมข้อความไทยใหม่ (เช่น "เกณฑ์ผ่านต้องอยู่ระหว่าง 50-100")
- แก้คอมเมนต์ในสคีมา Prisma จาก "0-100" เป็น "50-100"
- **ต้องถามผู้ใช้ก่อนตัดสินใจ**: โจทย์รอบ 2 ข้อ 4 สั่งให้ปรับ "frontend form ของหน้าสร้าง/แก้ไขแบบทดสอบ" แต่หน้านั้นไม่มีอยู่จริง — จะ (ก) สร้างหน้าจอสร้างแบบทดสอบทั้งหมดในรอบนี้ (งานใหญ่กว่าที่ระบุไว้ 5 จุดเดิมมาก และเป็นงานค้างของเฟส 6 ไม่ใช่ของขอบเขตใหม่ 2.3.1-2.3.4) หรือ (ข) แก้แค่ backend validation ตามที่มีจริง แล้วบันทึกไว้ว่าเมื่อสร้างหน้าจอนั้นในอนาคตต้องใช้ขอบเขต 50-100 นี้

---

## 4. การเรียนแบบ Soft Lock — 🟢 มีและตรงอยู่แล้ว

**ไฟล์ที่เกี่ยวข้อง**
- `backend/src/modules/learn/learn.service.ts:61-101,104-169` — `getRoom()`/`getLesson()` เช็คแค่ `access.assertEnrolled()` ไม่มีเช็คลำดับบทเรียนหรือผลสอบ
- `backend/prisma/schema.prisma` — ไม่มีฟิลด์ `isRequiredForCompletion` เลย (มีแต่ใน PLAN.md หัวข้อ 1.3 เป็นสเปกที่ไม่เคยทำจริง ตรงกับที่ CLAUDE.md หัวข้อ 8 บันทึกไว้ว่า `maxAttempts`/`timeLimitMinutes` ก็ถูกตัดไปแบบเดียวกัน)
- `backend/src/modules/lessons/lessons.controller.ts:86-110` + `course-access.service.ts:94-108` (`canReadLessonContent`) — เช็คแค่ ADMIN/เจ้าของ/preview/ลงทะเบียนแล้ว ไม่มีเช็คลำดับหรือคะแนนสอบ
- `frontend/.../[courseId]/[lessonId]/LessonSidebar.tsx:44-96` — ทุกบทเรียนเป็น `<Link>` ธรรมดา ไม่มี `disabled` ไม่มีไอคอนล็อก มีแค่ไอคอนสถานะ (เรียนจบ/กำลังเรียน/ยังไม่เริ่ม) ซึ่งเป็นแค่ตัวบอกความคืบหน้า ไม่ใช่การกันสิทธิ์

**สถานะปัจจุบัน**
ระบบเป็น Soft Lock อยู่แล้วตั้งแต่ต้น ไม่เคยมี hard lock logic ใดๆ ทั้ง backend และ frontend ตรงตามขอบเขตใหม่ 100%

**สิ่งที่ต้องทำ**
ไม่ต้องแก้โค้ด — ยืนยันด้วยการรันเทสต์ที่มีอยู่ผ่านตามปกติในรอบ 2 เผื่อกันการกลับมาเพิ่ม hard lock โดยไม่ตั้งใจในอนาคต (ไม่จำเป็นต้องเพิ่มเทสต์ใหม่เว้นแต่ต้องการ regression guard)

---

## 5. ระบบแจ้งเนื้อหาไม่เหมาะสม (ContentReport) — 🔴 ยังไม่มีเลย

**ไฟล์ที่เกี่ยวข้อง**
- ไม่มีโมเดล/ตาราง/service ใดๆ ที่เกี่ยวกับการแจ้งเนื้อหาเลยในระบบ (grep `ContentReport`, `flagReason`, `reportReason`, `inappropriate`, `suspend` ไม่พบ)
- `backend/prisma/schema.prisma:34-42` — `CourseStatus` enum ปัจจุบันมี `DRAFT | PENDING_REVIEW | PUBLISHED | REJECTED | UNPUBLISHED` เท่านั้น **ไม่มีสถานะที่แปลว่า "ถูกระงับชั่วคราวเพราะถูกแจ้ง แต่คนที่ซื้อแล้วยังเข้าเรียนได้"** — `UNPUBLISHED` ใกล้เคียงที่สุดแต่ความหมายคือผู้สอนถอดคอร์สเอง คนละเหตุผลกับการถูก ADMIN ระงับจากการแจ้ง
- `backend/src/modules/courses/courses.service.ts:64,461` — หน้าค้นหา/หน้าหลักโชว์เฉพาะ `status: PUBLISHED` (ดีอยู่แล้ว ถ้าเพิ่มสถานะใหม่แค่ไม่ใส่ในเงื่อนไขนี้ก็พอ)
- `backend/src/modules/learn/learn.service.ts` — การเข้าห้องเรียนเช็คจากแถว `Enrollment` เท่านั้น **ไม่ได้เช็ค `Course.status` เลย** ซึ่งดีมาก เพราะแปลว่า "ระงับการมองเห็นแต่คนลงทะเบียนแล้วเข้าได้ปกติ" ทำได้เลยโดยไม่ต้องแก้ชั้นนี้ — เพิ่มแค่สถานะใหม่ที่ไม่ถูกกรองออกจาก enrollment check ก็พอ
- **ระวังอย่าสับสนกับของเดิมที่มีชื่อคล้ายกัน**: `backend/src/modules/reports/` และหน้า `ReportsView.tsx` (admin/instructor) เป็นรายงานยอดขาย/บัญชีคู่ **คนละเรื่องกันโดยสิ้นเชิง** กับ ContentReport ที่จะสร้างใหม่
- **โมเดล `Review` (ให้ดาว) และ `PATCH /admin/reviews/:id/status` ก็ยังไม่มีอยู่จริง** — เป็นงานค้างเฟส 7 ที่ยังไม่ทำ (สับสนกันได้ง่ายเพราะชื่อคล้าย "รีวิว" แต่เป็นฟีเจอร์ดาว ไม่ใช่ระบบแจ้งเนื้อหา)
- Frontend: ไม่มีปุ่ม "แจ้งเนื้อหา" ที่หน้ารายละเอียดคอร์สหรือหน้ากระทู้ถาม-ตอบเลย
- Pattern ที่ใช้อ้างอิงได้: `frontend/src/app/(admin)/admin/courses/CourseReviewQueue.tsx`, `admin/topups/TopupQueue.tsx` + `ReviewDialog.tsx`

**⚠️ จุดที่ต้องตัดสินใจก่อนรอบ 2 — ชนกับ route เดิม**
โจทย์รอบ 2 ข้อ 2 ระบุ endpoint `GET /admin/reports` สำหรับคิวเนื้อหาที่ถูกแจ้ง แต่ **`admin/reports` ถูกใช้แล้ว** โดย `AdminReportsController` (รายงานยอดขาย/ภาพรวม/งบทดลอง — `GET /admin/reports/overview`, `/sales`, `/ledger` ตาม PLAN.md หัวข้อ 2) ต้องเปลี่ยนชื่อ route ของฟีเจอร์ใหม่ เช่น `POST /content-reports`, `GET /admin/content-reports`, `PATCH /admin/content-reports/:id/review` เพื่อไม่ชนกัน

**สถานะปัจจุบัน**
ไม่มีอะไรเลยแม้แต่ชิ้นเดียว ต้องสร้างใหม่ทั้งหมดตามที่โจทย์รอบ 2 ข้อ 2 ระบุ

**สิ่งที่ต้องทำ**
- Migration: โมเดล `ContentReport` (id, reporterId→User, targetType `COURSE`|`QNA_THREAD`, targetId, reason, status `PENDING`|`REVIEWED`|`DISMISSED`, reviewedById?, reviewedAt?, createdAt)
- เพิ่มค่าใหม่ใน `CourseStatus` enum สำหรับ "ระงับชั่วคราวจากการถูกแจ้ง" (ต้องตั้งชื่อที่ไม่ชนกับ `UNPUBLISHED` ความหมายเดิม เช่น `SUSPENDED`) — ตรวจสอบทุกจุดที่ query ตาม `status: PUBLISHED` ให้แน่ใจว่าคอร์สที่ถูกระงับไม่โผล่ในหน้าค้นหา/หน้าแรก และหน้ารายละเอียดคอร์สสำหรับคนทั่วไปตอบ 404 เหมือนคอร์สที่ไม่ publish (เจ้าของ/ADMIN ยังเห็นได้)
- Endpoint: `POST /content-reports` (login แล้วแจ้งได้ทุกบทบาท — ไม่ต้อง `@Roles` เฉพาะ ใช้ default-authenticated เหมือน `qna.controller.ts`) โดยถ้า `targetType=QNA_THREAD` ต้องเรียก `CourseAccessService.resolveQnaAccess()` ก่อนบันทึก เพื่อยืนยันว่าผู้แจ้งเข้าถึงกระทู้นั้นได้จริงตามสิทธิ์เดิม
- Endpoint: `GET /admin/content-reports` และ `PATCH /admin/content-reports/:id/review` — `@Roles(ADMIN)` เหมือน admin controller อื่นๆ ที่มีอยู่แล้ว
- Frontend: ปุ่ม "แจ้งเนื้อหาไม่เหมาะสม" ที่หน้าคอร์ส + หน้ากระทู้ถาม-ตอบ เปิด dialog กรอกเหตุผล, หน้า `/admin/content-reports` ใหม่ (ใช้ pattern เดียวกับ `CourseReviewQueue.tsx`/`TopupQueue.tsx`)

---

## RBAC — 🟢 ภาพรวมตรงอยู่แล้ว (มีจุดที่ต้องออกแบบใหม่สำหรับฟีเจอร์ที่ยังไม่มี)

**ไฟล์ที่ตรวจแล้วและผ่าน**
- `backend/src/app.module.ts:67-69` — ยืนยันว่า `ThrottlerGuard` → `JwtAuthGuard` → `RolesGuard` ลงทะเบียนเป็น `APP_GUARD` ทุก route ต้อง login เป็นค่าเริ่มต้นจริง `@Public()` เป็น opt-in ตรงตาม CLAUDE.md
- คอร์ส/บทเรียน: `courses.controller.ts` และ `lessons.controller.ts` ทุก endpoint ที่แก้ไขมี `@Roles(INSTRUCTOR, ADMIN)` และ service เรียก `CourseAccessService.assertCourseOwner`/`assertLessonOwner` ก่อนแตะข้อมูลเสมอ (`courses.service.ts:256,303,343,394`, `lessons.service.ts:72,96,127,155,201`) · `create` ใช้ `user.id` จาก token เสมอ ไม่เชื่อ body
- แบบทดสอบ: `quizzes.controller.ts` endpoint ผู้สอนมี `@Roles(INSTRUCTOR, ADMIN)` + `access.assertLessonOwner` ที่ service · endpoint ผู้เรียน (`take`/`submit`/`myAttempts`) ตั้งใจไม่มี `@Roles` เพราะเช็ค `assertEnrolled` แทน (มีคอมเมนต์อธิบายไว้แล้ว)
- Admin controllers ทั้งหมด (`admin-courses`, `admin-categories`, `admin-topups`, `admin-users`, `AdminReportsController`) มี `@Roles(ADMIN)` ระดับ class ครบ
- Q&A: `CourseAccessService.resolveQnaAccess()` (`course-access.service.ts:152-180`) เป็นจุดเดียวที่ตัดสินสิทธิ์ ทุก method ใน `qna.service.ts` เรียกจุดนี้ก่อนเสมอ
- Frontend: ตรวจ `CourseReviewQueue.tsx`, `ReportsView.tsx`, `TopupQueue.tsx`, `UsersTable.tsx`, `(admin)/layout.tsx` — ไม่พบการเช็คสิทธิ์แค่ฝั่ง frontend โดยไม่มี guard คู่กันที่ backend `middleware.ts` ใช้ `decodeJwt` แบบไม่ verify ลายเซ็นตามที่ตั้งใจไว้ (UX เท่านั้น อำนาจจริงอยู่ backend)

**สิ่งที่ต้องทำสำหรับฟีเจอร์ใหม่ (ContentReport) เท่านั้น — ไม่ใช่การแก้ของเดิม**
- Endpoint แจ้งเนื้อหา: default-authenticated ไม่ต้อง `@Roles` เฉพาะ (ทุกบทบาท login แล้วแจ้งได้ตามโจทย์) แต่ถ้า target เป็นกระทู้ถาม-ตอบ ต้องเรียก `resolveQnaAccess()` ก่อนเพื่อกันคนที่เข้าถึงกระทู้ไม่ได้มาแจ้ง
- Endpoint ดู/ตัดสินใจคิว: ต้อง `@Roles(ADMIN)` เหมือน controller อื่นๆ (ดูหัวข้อ 5 เรื่องชื่อ route ที่ต้องเลี่ยงการชนกับ `admin/reports` เดิม)
- ไม่พบปัญหา RBAC อื่นใดที่ต้องแก้นอกเหนือจากฟีเจอร์ใหม่นี้

---

## Non-functional requirements

### ข้อความ error/validation ภาษาไทย
- ปัจจุบัน error message ของ `passScore` เป็นภาษาไทยอยู่แล้ว (เช่น "เกณฑ์ผ่านต้องไม่เกิน 100") เป็นแบบอย่างที่ต้องทำตามสำหรับข้อความใหม่ (ราคาคอร์ส, พื้นที่จัดเก็บ, การแจ้งเนื้อหา)
- ข้อความราคาคอร์สและพื้นที่จัดเก็บที่จะเพิ่มใหม่ต้องระบุตัวเลขเพดานตรงๆ ตามที่โจทย์กำหนด เช่น "ราคาคอร์สต้องไม่เกิน 10,000 บาท" และ "พื้นที่จัดเก็บคงเหลือ X MB จากทั้งหมด 3 GB"

### Performance การคำนวณพื้นที่จัดเก็บ
- ยืนยันแล้วว่าไม่มีการ SUM สดในระบบตอนนี้เลย (เพราะฟีเจอร์นี้ไม่มีอยู่จริง) — การออกแบบใหม่ต้องใช้ยอดสะสมแบบ cached ที่ `Course.storageUsedBytes` ตามที่โจทย์ระบุไว้แล้ว ไม่ใช่คำนวณสดทุกครั้งที่ presign — ดูรายละเอียดในหัวข้อ 2

### จุดที่ CLAUDE.md / PLAN.md จะขัดกับขอบเขตใหม่
- **PLAN.md หัวข้อ 1.2** (`Course.status`) ระบุ `DRAFT → PENDING_REVIEW → PUBLISHED / REJECTED` และ `PUBLISHED → UNPUBLISHED` เท่านั้น — ต้องเพิ่มสถานะใหม่ (เช่น `SUSPENDED`) และคำอธิบายกติกาการระงับจากการแจ้งเนื้อหา
- **PLAN.md หัวข้อ 1.3** (ตาราง Quiz) ยังเขียน `passingScorePercent Decimal(5,2)` ซึ่งต่างจาก schema จริงที่ใช้ `passScore Int` อยู่แล้ว (ความต่างเดิม ไม่เกี่ยวกับงานนี้โดยตรง) — ถ้าจะแก้ไปพร้อมกันควรระบุเพดานใหม่ 50-100 ไว้ในตารางนี้ด้วย
- **PLAN.md หัวข้อ 2** (ตาราง API endpoints) ไม่มีแถวสำหรับ endpoint แจ้งเนื้อหา/คิวตรวจการแจ้งเลย ต้องเพิ่มเข้าไปหลังทำเสร็จ และหัวข้อ 1 (รายการ entity) ต้องเพิ่ม `ContentReport` เข้ารายการ 27 entity (จะกลายเป็น 28)
- **PLAN.md หัวข้อ 0** (ตารางขอบเขตที่ตัดสินใจแล้ว) และหัวข้อ "นอกขอบเขต" ไม่มีข้อความขัดแย้งกับ 5 จุดนี้โดยตรง แต่ไม่เคยพูดถึงเพดานราคา/พื้นที่จัดเก็บมาก่อนเลย ต้องเพิ่มเป็นบรรทัดใหม่
- **CLAUDE.md หัวข้อ 5 "เรื่องเงิน"** ไม่มีข้อความขัดแย้งเรื่องเพดานราคา (ไม่เคยระบุเพดานไว้) — เพิ่มได้โดยไม่ต้องลบอะไร
- **ไม่พบข้อความเรื่อง hard lock ที่ต้องลบออก** ทั้ง CLAUDE.md และ PLAN.md ไม่เคยเขียนถึง hard lock ไว้เลย (สอดคล้องกับที่ระบบเป็น soft lock อยู่แล้วในหัวข้อ 4) — ไม่มีอะไรต้องแก้ในส่วนนี้
- CLAUDE.md หัวข้อ 8 (บันทึกท้ายเฟส 6) ยังคงเป็นจริงอยู่ว่า "ยังไม่มีหน้าจอให้ผู้สอนสร้างข้อสอบ" — เป็นเหตุผลของจุดที่ต้องถามในหัวข้อ 3 ด้านบน

---

## สรุปสิ่งที่ต้องตัดสินใจก่อนเข้ารอบ 2

1. **ชื่อ route ของ ContentReport ชนกับ `admin/reports` เดิม** (รายงานยอดขาย) — เสนอเปลี่ยนเป็น `content-reports` / `admin/content-reports`
2. **ยังไม่มีหน้าจอสร้าง/แก้ไขแบบทดสอบของผู้สอนเลย** (ค้างจากเฟส 6) — โจทย์ข้อ 4 ขอปรับ "frontend form" ของมัน แต่ฟอร์มนั้นไม่มีอยู่จริง ต้องตัดสินใจว่าจะสร้างทั้งหน้าในรอบนี้ (นอกขอบเขตเดิมของ 5 จุด) หรือแก้แค่ backend validation ไปก่อน
3. **ต้องตั้งชื่อสถานะคอร์สใหม่สำหรับการระงับจากการแจ้ง** (เสนอ `SUSPENDED`) เพื่อไม่ให้ปนกับ `UNPUBLISHED` ที่ความหมายต่างกัน

รอการยืนยันจากผู้ใช้ก่อนเริ่มรอบที่ 2
