# UI_CONSISTENCY_AUDIT.md — ตรวจสอบความสม่ำเสมอของ UI เทียบ design-reference

รอบตรวจสอบเท่านั้น **ยังไม่มีการแก้โค้ดใดๆ ในเอกสารนี้** ข้อมูลมาจาก 3 แหล่ง:
1. `MIGRATION_LOG.md` (บันทึกการแปลงดีไซน์ 10 หน้าที่มีอยู่แล้ว มีรายละเอียดระดับพิกเซล)
2. `git log` ไล่ทุก commit ที่แตะไฟล์ของแต่ละหน้า **หลัง** commit ที่แปลงดีไซน์เสร็จ เพื่อจับ drift ที่เกิดทีหลัง
3. screenshot จริงจากเบราว์เซอร์ (Playwright, desktop 1440px) เทียบกับโค้ดและกับที่ 1-2 บันทึกไว้

ไม่พบ `DESIGN.md` ระดับโปรเจกต์ (มีแต่ `design-reference/.../prestige_thai_academy/DESIGN.md` ซึ่งเป็นไฟล์ของเทมเพลตต้นทางที่ใช้สีชุดเก่า ไม่ใช่เอกสารของโปรเจกต์นี้) — กลุ่ม B จึงตรวจเทียบกับรูปแบบของกลุ่ม A ตามที่โจทย์กำหนดไว้เป็นทางเลือกสำรอง

---

## สรุปภาพรวม (อ่านก่อน)

**ข่าวดี:** ไม่พบสีนอก token, ไม่พบ gradient, ไม่พบเงาหนา, ไม่พบ icon library อื่นนอก lucide-react ที่ไหนเลยในทั้งระบบ — วินัยเรื่องกฎข้อห้าม 17/18 ที่ตั้งไว้ตอนแปลงดีไซน์ยังคงอยู่ครบหลังงานฟีเจอร์ใหม่ๆ ทุกตัว รวมถึงงาน ContentReport ที่ผมเพิ่งสร้างเอง

**สิ่งที่ต้องแก้จริงมีจุดเดียว แต่กระทบวงกว้าง:** หัวข้อหน้า (page title) ของ**ครึ่งหนึ่งของหน้าในระบบ**ไม่ได้ใช้ `SectionHeading` (แถบทองซึ่งเป็นลายเซ็นหลักของดีไซน์ทั้งชุด) รายละเอียดอยู่หัวข้อ "จุดที่ต้องแก้" ด้านล่าง — นี่คือสิ่งที่การตรวจแบบ agent 2 ตัวแยกกันตรวจ "กลุ่ม A" กับ "กลุ่ม B" คนละชุดไม่เห็นภาพรวม เพราะไฟล์ที่มีปัญหากระจายอยู่ทั้งสองกลุ่ม ผมจึงรวมเป็นหัวข้อเดียวแยกต่างหากท้ายเอกสารแทนที่จะฝังในตารางกลุ่ม A/B

---

## กลุ่ม A — หน้าที่มี design reference ตรงๆ (10 หน้า)

ไล่ตาม `MIGRATION_LOG.md` ทีละหน้า เช็คว่า commit ใดๆ **หลัง**จาก commit แปลงดีไซน์ (8 commits: landing → login → register → forgot/reset → home → catalog → course-detail → topup → instructor → admin) มีอะไรมาแตะไฟล์เหล่านี้อีกไหม และถ้ามี มันทำให้สี/แถบทอง/spacing/component เพี้ยนไปจากที่บันทึกไว้หรือเปล่า

| # | หน้า | Commit หลังแปลงดีไซน์ | ผลตรวจ |
|---|---|---|---|
| 1 | landing_page (`/`) | `285f6a7` เพิ่ม `size="lg"` ให้ `SectionHeading` ใน 3 section (แก้ปัญหา heading เท่ากันหมด ตามที่ตั้งใจ) | ✅ ตรงตามดีไซน์ ไม่ต้องแก้ |
| 2 | login_screen (`/login`) | ไม่มี | ✅ ตรงตามดีไซน์ ไม่ต้องแก้ |
| 3 | register_screen (`/register`) | ไม่มี (มีแก้ uncommitted แค่ parsing `?role=` ฝั่ง server ไม่แตะสไตล์) | ✅ ตรงตามดีไซน์ ไม่ต้องแก้ |
| 4 | forgot_password/reset_password | ไม่มี | ✅ ตรงตามดีไซน์ ไม่ต้องแก้ |
| 5 | student_dashboard (`/home`) | ไม่มี | ✅ ตรงตามดีไซน์ ไม่ต้องแก้ |
| 6 | course_catalog (`/courses`) | ไม่มี | ✅ ตรงตามดีไซน์ ไม่ต้องแก้ |
| 7 | course_detail (`/courses/[id]`) | `09acdcb` เพิ่มปุ่ม `ReportContentButton` (งานของผมเองรอบก่อน) | ✅ ตรวจโค้ดแล้ว ใช้ token สี/`<dialog>`/`Button`/`Alert`/`Field` ตามแบบเดิมทั้งหมด ไม่มีอะไรหลุด ไม่ต้องแก้ |
| 8 | wallet_top_up (`/wallet/topup`) | ไม่มี | ✅ ตรงตามดีไซน์ ไม่ต้องแก้ |
| 9 | instructor_dashboard (`/instructor`) | ไม่มี | ✅ ตรงตามดีไซน์ ไม่ต้องแก้ |
| 10 | admin_dashboard (`/admin`) | ไม่มี (commit เดียวคือ commit แปลงดีไซน์เอง) | ✅ ตรงตามดีไซน์ ไม่ต้องแก้ — ตรวจ screenshot จริงแล้ว เมนู "รายการที่ถูกแจ้ง" ที่เพิ่มเข้า sidebar ทีหลังก็ใช้ `SidebarLink` ตัวเดียวกัน แถบทองซ้ายเหมือนเมนูอื่นทุกอย่าง |

**สรุปกลุ่ม A: ทั้ง 10 หน้ายังตรงตามที่ `MIGRATION_LOG.md` บันทึกไว้ ไม่มี drift ใหม่เกิดขึ้นเลยหลังงานฟีเจอร์ต่างๆ ที่ทำเพิ่มมา** (รวมงาน ContentReport, ราคาคอร์ส, พื้นที่จัดเก็บ ที่ผมทำเองในเซสชันนี้)

**หมายเหตุนอกเรื่องดีไซน์:** พบว่า `frontend/src/app/(public)/page.tsx` และไฟล์ `HeroSection.tsx` ที่ต่อ section ทั้งหมดเข้าด้วยกันจริงยัง**ไม่ถูก commit** (เป็นงานที่ค้างอยู่ก่อนหน้าเซสชันนี้แล้ว ไม่ใช่สิ่งที่ผมทำ) — screenshot ที่ผมถ่ายยืนยันว่าโค้ดปัจจุบันทำงานถูกต้องครบทุก section แล้ว แค่ยังไม่มีใคร commit เท่านั้น ไม่ใช่ปัญหาด้านดีไซน์แต่ควร commit เพื่อไม่ให้งานหาย

---

## กลุ่ม B — หน้าที่ไม่มี design reference ตรงๆ (~19 หน้า)

ตรวจ 17 ไฟล์/กลุ่มไฟล์หลัก เทียบกับรูปแบบที่กลุ่ม A established ไว้ (token สี, `SectionHeading`, `Card`/`CardHeader`/`CardTitle`, `Badge`/`Button`/`Input`/`Field`/`Progress`/`Select` ที่ใช้ร่วมกัน, ไม่มี gradient/เงาหนา, รัศมีมุม `rounded-control`/`rounded-card`)

**ไม่พบ Major drift ที่ไหนเลย** — ไม่มีสีนอก token, ไม่มี gradient, ไม่มีเงาหนา, ไม่มีการประดิษฐ์ระบบ component ใหม่ที่ไม่เข้าพวกที่ไหนในกลุ่มนี้

| หน้า/ไฟล์ | ผล |
|---|---|
| `/profile` (ProfileView.tsx) | ตรงตามมาตรฐาน — ยกเว้นหัวข้อหน้า+3 การ์ดย่อยไม่มีแถบทอง (ดูหัวข้อถัดไป) |
| `/my-courses` (MyCoursesView.tsx) | ตรงตามมาตรฐาน — ยกเว้นหัวข้อหน้า (ดูหัวข้อถัดไป) |
| `/wallet` (WalletView.tsx) | ✅ ตรงตามมาตรฐานครบ ใช้ `Card`/`CardHeader`/`CardTitle`/`Badge`/`Pager` ถูกต้อง |
| ห้องเรียน (`LessonView`/`LessonSidebar`/`LessonPlayer`/`LessonTabs`) | ✅ ตรงตามมาตรฐานครบ |
| แบบทดสอบ (`QuizView`/`ScoreDial`/`QuizResultView`) | ✅ ตรงตามมาตรฐาน (แอนิเมชัน `ScoreDial` ยาว 700ms เกิน ≤150ms ที่กำหนดไว้ แต่มีคอมเมนต์อธิบายเหตุผลกำกับไว้แล้วเหมือนที่อื่นในระบบที่ได้รับการยกเว้นแบบเดียวกัน) |
| ถาม-ตอบ (`QnaBoard`/`QnaThreadView`/`AskQuestionForm`) | ตรงตามมาตรฐาน — ยกเว้นหัวข้อหน้าของ `QnaBoard.tsx` (ดูหัวข้อถัดไป) |
| หน้าแก้ไขคอร์สของผู้สอน (`GeneralTab`/`LessonRow`/`CurriculumTab`) | ✅ ตรงตามมาตรฐานครบ ใช้ `Card`/`CardHeader`/`CardTitle` ถูกต้อง (รวมแถบพื้นที่จัดเก็บที่ผมเพิ่งเพิ่ม) |
| `/instructor/courses/new` | ✅ ตรงตามมาตรฐานครบ |
| `/instructor/qna` (InstructorQnaInbox.tsx) | ตรงตามมาตรฐาน — ยกเว้นหัวข้อหน้า (ดูหัวข้อถัดไป) |
| `/instructor/reports` (InstructorReportsView.tsx) | ตรงตามมาตรฐาน — ยกเว้นหัวข้อหน้า+2 การ์ดย่อย (ดูหัวข้อถัดไป) |
| `/admin/categories` (CategoriesManager.tsx) | ตรงตามมาตรฐาน — ยกเว้นหัวข้อหน้า+ฟอร์มเพิ่ม/แก้หมวดหมู่ (ดูหัวข้อถัดไป) |
| `/admin/courses` (CourseReviewQueue.tsx) | ตรงตามมาตรฐาน — ยกเว้นหัวข้อหน้า (ดูหัวข้อถัดไป) |
| `/admin/users` (UsersTable.tsx) | ตรงตามมาตรฐาน — ยกเว้นหัวข้อหน้า (ดูหัวข้อถัดไป) |
| `/admin/topups` (TopupQueue.tsx + ReviewDialog.tsx) | ตรงตามมาตรฐาน — ยกเว้นหัวข้อหน้า (ดูหัวข้อถัดไป) |
| `/admin/reports` (ReportsView.tsx) | ตรงตามมาตรฐาน — ยกเว้นหัวข้อหน้า+3 ส่วนย่อย (ดูหัวข้อถัดไป) |
| `/admin/content-reports` (ContentReportQueue.tsx — ของใหม่ที่ผมสร้างเอง) | ตรงตามมาตรฐาน — ยกเว้นหัวข้อหน้า (ผมคัดลอกแบบมาจาก `CourseReviewQueue.tsx` ซึ่งเป็นไฟล์ที่มีปัญหาเดียวกันอยู่ก่อนแล้ว ดูหัวข้อถัดไป) |
| `ReportContentButton.tsx` (ของใหม่ที่ผมสร้างเอง) | ✅ ตรงตามมาตรฐานครบ ใช้ `<dialog>` pattern เดียวกับ `ReviewDialog.tsx` |

---

## จุดที่ต้องแก้ — หัวข้อหน้าไม่มีแถบทอง (`SectionHeading`)

ตรวจเพิ่มเติมด้วย `grep` ทั้งระบบ (ไม่ใช่แค่ 17 ไฟล์ข้างบน) พบว่าเป็นปัญหาที่**กว้างกว่าที่การตรวจแยกกลุ่มเห็น** — grep `text-2xl font-semibold text-primary` (รูปแบบ raw `<h1>` ที่ไม่ผ่าน `SectionHeading`) เจอ **13 ไฟล์**:

```
frontend/src/app/(student)/my-courses/MyCoursesView.tsx:48
frontend/src/app/(student)/wallet/WalletView.tsx:51                    ← แต่ WalletView ใช้ SectionHeading จุดอื่นในหน้าถูกต้อง จุดนี้เฉพาะ h1
frontend/src/app/(account)/profile/ProfileView.tsx:93
frontend/src/app/(student)/learn/[courseId]/qna/QnaBoard.tsx:104
frontend/src/app/(instructor)/instructor/reports/InstructorReportsView.tsx:76
frontend/src/app/(admin)/admin/courses/CourseReviewQueue.tsx:94
frontend/src/app/(admin)/admin/users/UsersTable.tsx:108
frontend/src/app/(admin)/admin/categories/CategoriesManager.tsx:76
frontend/src/app/(admin)/admin/reports/ReportsView.tsx:132
frontend/src/app/(instructor)/instructor/qna/InstructorQnaInbox.tsx:56
frontend/src/app/(instructor)/instructor/courses/[id]/page.tsx:153     ← ชื่อคอร์สเอง ไม่ใช่หัวข้อ section แบบเดียวกัน อาจไม่ต้องแก้
frontend/src/app/(admin)/admin/topups/TopupQueue.tsx:85
frontend/src/app/(admin)/admin/content-reports/ContentReportQueue.tsx:101  ← ของผมเอง สร้างสัปดาห์นี้
```

เทียบกับอีกฝั่งที่ใช้ `SectionHeading as="h1"` ถูกต้องแล้ว: `AdminDashboard.tsx`, `instructor/page.tsx`, `courses/page.tsx` (catalog), `TopupForm.tsx` (ขั้นตอนแรกของ wallet/topup), `HomeView.tsx` (ยกเว้นข้อความทักทายส่วนตัวซึ่งตั้งใจไม่ใช้ตามที่ MIGRATION_LOG บันทึกไว้)

**เหตุผลที่เกิดช่องว่างนี้:** `SectionHeading` เป็น component ที่เพิ่งสร้างตอนแปลงดีไซน์ (งาน 10 หน้า) หน้าที่อยู่นอกงานแปลงดีไซน์ (กลุ่ม B ทั้งหมด) ถูกสร้างไว้ก่อนหน้านั้นในเฟส 2-8 เดิม จึงยังใช้รูปแบบหัวข้อแบบเก่า และไม่มีใครย้อนกลับไปอัปเดตตามที่ `MIGRATION_LOG.md` เองก็บันทึกไว้ตอนท้ายว่า **"หน้าที่อยู่นอก 10 หน้านี้ยังไม่ได้ตรวจด้วยตา"** — นี่คือช่องว่างนั้นที่งานตรวจสอบรอบนี้เจอพอดี ContentReportQueue.tsx ที่ผมสร้างเองก็ติดปัญหานี้ไปด้วยเพราะผมคัดลอกแบบจาก `CourseReviewQueue.tsx` ที่มีปัญหาเดียวกันอยู่ก่อนแล้ว โดยไม่ได้เช็คว่ามาตรฐานปัจจุบันคือ `SectionHeading`

**ผลกระทบ:** ไม่ใช่บั๊ก หน้าทำงานถูกต้องทุกอย่าง เป็นเรื่องความสม่ำเสมอล้วนๆ — แต่เป็น**ลายเซ็นหลักของงานออกแบบทั้งชุด** (แถบทองข้างหัวข้อ) หายไปจากหน้าที่ใช้งานบ่อยที่สุดครึ่งหนึ่งของระบบ (คิวอนุมัติ, จัดการผู้ใช้/หมวดหมู่, รายงาน, โปรไฟล์, กระดานถาม-ตอบ) คนที่เห็นหน้า `/admin` `/instructor` `/courses` ที่มีแถบทองก่อน แล้วมาเจือ `/admin/users` `/admin/categories` ที่ไม่มี จะสังเกตได้ว่าไม่ครบชุด

**วิธีแก้ (สำหรับตอนลงมือจริง ไม่ใช่ตอนนี้):** แทนที่ `<h1 className="text-2xl font-semibold text-primary">{title}</h1>` (+ `<p>` บรรทัดถัดไปถ้ามี) ด้วย `<SectionHeading as="h1" title={title} subtitle={subtitle} action={...ถ้ามีปุ่ม/ตัวกรองท้ายแถว} />` — เป็นการแทนที่แบบตรงไปตรงมาในทุกไฟล์ ความเสี่ยงต่ำ ไม่กระทบ logic ใดๆ เลย เป็น cosmetic ล้วน

**หมวดหมู่ตามที่โจทย์กำหนด: มีความต่างที่เห็นชัดควรแก้ก่อนเดโม/สอบ** — เพราะกระทบเกินครึ่งของหน้าจอทั้งระบบและเป็นจุดที่ผู้ตรวจ/กรรมการสังเกตได้ง่ายที่สุดถ้าเทียบหน้าใกล้กัน (เช่น `/admin` มีแถบทอง แต่ `/admin/users` ที่คลิกถัดไปไม่มี)

**ไม่รวม `instructor/courses/[id]/page.tsx:153`** ในคำแนะนำแก้ เพราะบรรทัดนั้นคือ**ชื่อคอร์สของผู้ใช้เอง** ไม่ใช่หัวข้อ section ของหน้าจอ (เทียบไม่ได้ตรงๆ กับอีก 12 จุด) ต้องดูเป็นกรณีไป

---

## จุดสังเกตเล็กน้อยที่ไม่จำเป็นต้องแก้

- `frontend/src/components/shared/HeroCourseMockup.tsx:18` มี `shadow-sm` บนกล่อง mockup วิดีโอตกแต่งใน hero ซึ่งไม่ใช่ dropdown/popover/modal ตามที่ข้อห้าม 18 ระบุไว้ว่าอนุญาตเฉพาะ 3 ที่นี้ — แต่ `shadow-sm` เป็นเงาที่บางที่สุดในสเกลของ Tailwind (แทบมองไม่เห็นต่างจากไม่มีเงาเลย) และเป็นองค์ประกอบตกแต่งจุดเดียวในหน้า landing ไม่ใช่การ์ดเนื้อหา จึงมองว่าเป็นจุดที่ยอมรับได้ ไม่จำเป็นต้องแก้ แต่บันทึกไว้เผื่อพิจารณา
- `@radix-ui/react-label`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-slot` ยังใช้อยู่ในระบบ (ฐาน shadcn/ui) — **ไม่ใช่การละเมิดข้อห้าม 12** เพราะเป็นโค้ดพื้นฐานที่มีมาตั้งแต่ก่อนงานแปลงดีไซน์ ข้อห้ามในบันทึกของ MIGRATION_LOG หมายถึง "ไม่เพิ่ม Radix ใหม่สำหรับ tabs/dropdown/modal ที่สร้างเพิ่มระหว่างงานนี้" (ซึ่งทำถูกต้องแล้ว ใช้ native `<dialog>`/`<select>`/ปุ่มธรรมดาตลอด) ไม่ใช่ห้ามใช้ของเดิมที่มีอยู่แล้ว

---

## สรุปตามหมวดที่โจทย์กำหนด

**✅ ตรงตามดีไซน์/มาตรฐานอยู่แล้ว ไม่ต้องแก้**
กลุ่ม A ทั้ง 10 หน้า · กลุ่ม B ส่วนที่เหลือ 4 หน้า (`/wallet`, ห้องเรียน, แบบทดสอบ, หน้าแก้ไขคอร์สผู้สอน, `/instructor/courses/new`, `ReportContentButton.tsx`) · สีทั้งระบบ · ไม่มี gradient/เงาหนา/icon library อื่น/Radix ใหม่ที่ไหนเลย

**⚠️ มีความต่างเล็กน้อยที่ควรแก้**
ไม่มีจุดอื่นนอกเหนือจากที่ระบุด้านล่าง (ทุกอย่างที่พบรวมอยู่ในหมวดถัดไปเพราะกระทบวงกว้าง)

**🔴 มีความต่างที่เห็นชัดต้องแก้ก่อนเดโม/สอบ**
หัวข้อหน้าไม่มีแถบทอง (`SectionHeading`) ใน 12 ไฟล์ (รายชื่อและบรรทัดด้านบน) — งานแก้เป็น cosmetic ล้วน ความเสี่ยงต่ำมาก ประเมินว่าทำได้ในรอบเดียวถ้าได้รับการยืนยัน

---

รอการยืนยันจากผู้ใช้ก่อนแก้ไขตามที่พบในเอกสารนี้ (ตามที่ตกลงไว้ว่าเรื่องที่ 1 ต้องรอ) — เรื่องที่ 2 และ 3 ดำเนินการต่อแล้วโดยไม่ต้องรอ ตามที่ระบุไว้ในคำสั่ง
