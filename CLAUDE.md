# CLAUDE.md — getownly

เอกสารนี้คือบริบทถาวรของโปรเจกต์ อ่านไฟล์นี้ก่อนเสมอเมื่อเริ่ม session ใหม่
รายละเอียดขอบเขต/แผนงานอยู่ใน [PLAN.md](PLAN.md)

---

## 1. สรุประบบ (5 บรรทัด)

1. getownly คือแพลตฟอร์มตลาดกลาง (marketplace) ขายคอร์สเรียนออนไลน์บนเว็บเดียว ผู้สอนหลายคนเปิดคอร์สขาย ผู้เรียนค้นหาและซื้อ แพลตฟอร์มหักส่วนแบ่งรายได้
2. ชำระเงินแบบไทย: ระบบ gen QR PromptPay ระบุจำนวนเงิน → ผู้เรียนโอนแล้วแนบสลิป → ADMIN ตรวจและอนุมัติ → เงินเข้ากระเป๋าในระบบ (wallet) → ซื้อคอร์สโดยตัดจากกระเป๋า
3. **ไม่มี payment gateway และไม่มีการตรวจยอดเงินอัตโนมัติ** — ทุกการเติมเงินผ่านสายตา ADMIN (ข้อจำกัดที่ยอมรับไว้ของงานปริญญานิพนธ์)
4. บทบาทผู้ใช้ 3 แบบ: STUDENT (ซื้อ/เรียน/สอบ/ถาม/รีวิว) · INSTRUCTOR (สร้างคอร์ส/อัปโหลด/ตอบคำถาม/ดูรายได้/ขอถอนเงิน) · ADMIN (อนุมัติสลิป/อนุมัติคอร์ส/ตั้งส่วนแบ่ง/จัดการระบบ/อนุมัติการถอน)
5. เงินทุกบาทเดินผ่านระบบบัญชีคู่ (double-entry ledger) ทุกรายการ debit = credit ยอดใน wallet เป็นเพียงยอดสรุปที่ derive จาก ledger

---

## 2. Tech stack (ล็อกแล้ว — ห้ามเปลี่ยน ห้ามเพิ่ม framework ใหญ่โดยไม่ถาม)

| ส่วน | เทคโนโลยี | เหตุผลสั้นๆ |
|---|---|---|
| Frontend | Next.js 15 App Router + TypeScript | Server Components ลดโค้ด fetch ฝั่ง client, routing ตามโฟลเดอร์อ่านง่ายตอนนำเสนอ |
| UI | Tailwind CSS v4 + shadcn/ui | v4 ประกาศ design token ใน CSS ด้วย `@theme` ตรงๆ, shadcn เป็นโค้ดในโปรเจกต์เองแก้ได้ ไม่ใช่ dependency ที่ล็อกสไตล์ |
| Backend | NestJS + TypeScript | โครง module/service/controller ชัดเจน มี DI + guard/interceptor พร้อม เหมาะกับงานที่มีสิทธิ์ 3 ระดับ |
| ORM | Prisma | type-safe, migration ตรวจสอบย้อนหลังได้, `$transaction` ใช้ง่ายซึ่งจำเป็นมากกับ ledger |
| DB | PostgreSQL 16 | รองรับ `NUMERIC` (Decimal) แท้จริง จำเป็นกับข้อมูลการเงิน |
| Storage | MinIO (S3-compatible) | รันใน Docker ได้เอง ไม่ต้องพึ่ง cloud ที่มีค่าใช้จ่าย API เหมือน S3 ย้ายขึ้นจริงได้ทีหลัง |
| Auth | JWT ที่ NestJS ออกเอง เก็บใน httpOnly cookie (access + refresh) | ไม่ต้องพึ่ง auth provider ภายนอก อธิบายกลไกได้ครบตอนสอบ |
| Email | Nodemailer + Mailhog (dev) | ทดสอบอีเมลได้โดยไม่ต้องส่งออกจริง |
| Test | Vitest (backend unit/integration), Playwright (e2e ทีหลัง) | Vitest เร็วและ config น้อย |
| Dev env | Docker Compose (postgres, minio, mailhog) | ยกสภาพแวดล้อมทั้งชุดด้วยคำสั่งเดียว ตั้งเครื่องใหม่ได้เร็ว |
| Package manager | pnpm (workspace) | ประหยัดพื้นที่ และแชร์ `packages/shared` ระหว่าง FE/BE ได้ |

**พอร์ตมาตรฐาน:** frontend `3000` · backend `4000` · postgres `5433` (พอร์ตบนเครื่อง — ภายใน container ยังเป็น `5432` ที่ตั้ง 5433 เพราะเครื่องพัฒนามักมี PostgreSQL ของตัวเองครอง 5432 อยู่แล้ว) · MinIO API `9000` / Console `9001` · Mailhog SMTP `1025` / UI `8025`

---

## 3. โครงสร้างโฟลเดอร์

```
getownly/
├─ pnpm-workspace.yaml
├─ package.json            สคริปต์รวมของทั้ง workspace
├─ docker-compose.yml      postgres + minio + mailhog
├─ CLAUDE.md
├─ PLAN.md
├─ README.md
│
├─ backend/                NestJS
│  ├─ .env.example         ตัวแปรฝั่ง backend (ห้าม commit .env จริง)
│  ├─ prisma/
│  │  ├─ schema.prisma
│  │  ├─ migrations/
│  │  └─ seed.ts
│  ├─ src/
│  │  ├─ main.ts
│  │  ├─ app.module.ts
│  │  ├─ common/           guards, decorators, filters, interceptors, pipes, utils
│  │  ├─ config/           config schema + validation ของ env
│  │  ├─ infra/            prisma.service, storage(minio).service, mail.service
│  │  └─ modules/          หนึ่งโดเมนหนึ่งโฟลเดอร์ (ดูข้อ 6)
│  └─ test/
│
├─ frontend/               Next.js
│  ├─ .env.example         ตัวแปรฝั่ง frontend (ห้าม commit .env.local จริง)
│  ├─ src/
│  │  ├─ app/              route groups: (public) (auth) (student) (instructor) (admin)
│  │  ├─ components/
│  │  │  ├─ ui/            shadcn/ui
│  │  │  └─ shared/        component ของโปรเจกต์เอง
│  │  ├─ lib/              api client, auth helper, formatters, utils
│  │  ├─ hooks/
│  │  └─ styles/globals.css   @theme design tokens
│  └─ public/
│
└─ packages/shared/        enums + response types ที่ FE/BE ใช้ร่วมกัน (ไม่มี runtime logic)
```

---

## 4. Design tokens (ใช้ทั้งระบบ ห้ามใช้สีนอกลิสต์)

ประกาศครั้งเดียวใน `frontend/src/styles/globals.css` ผ่าน `@theme` ของ Tailwind v4
แล้วใช้ผ่าน utility class เท่านั้น (`bg-primary`, `text-muted`, `border-border`) **ห้าม hardcode hex ในคอมโพเนนต์**

### สี

| บทบาท | ค่า | ใช้กับ |
|---|---|---|
| `primary` | `#1E3A5C` | ปุ่มหลัก, หัวข้อ, sidebar, ลิงก์สำคัญ |
| `secondary` | `#C9A063` | ราคา, ป้ายเน้น, accent, ไอคอนดาว |
| `foreground` | `#111827` | ข้อความหลัก |
| `muted` | `#6B7280` | ข้อความรอง |
| `subtle` | `#9CA3AF` | ข้อความจาง, placeholder |
| `border` | `#E5E7EB` | เส้นขอบทุกชนิด, เส้นคั่น |
| `background` | `#F8F9FA` | พื้นหน้า |
| `card` | `#FFFFFF` | พื้นการ์ด, พื้น modal |
| `success` | `#2E7D5B` | สำเร็จ, อนุมัติแล้ว, เผยแพร่แล้ว |
| `pending` | `#B8860B` | รอดำเนินการ, รอตรวจสอบ, ฉบับร่าง |
| `destructive` | `#B3261E` | ผิดพลาด, ปฏิเสธ, ลบ, ระงับบัญชี |

### ตัวอักษร

- ฟอนต์: **IBM Plex Sans Thai** ทั้งระบบ (โหลดผ่าน `next/font/google`, weight 400/500/600/700)
- ตัวเลขเงินและตาราง: ใช้ `font-variant-numeric: tabular-nums` เพื่อให้หลักตรงกัน

### รูปทรงและระยะ

- มุมโค้ง: **8px** สำหรับปุ่ม/ช่องกรอก/badge · **12px** สำหรับการ์ด/modal
- ระยะห่าง: ใช้สเกล 4px ของ Tailwind ตามปกติ
- เส้นขอบ: `1px solid border` เป็นค่าเริ่มต้นของการ์ดทุกใบ

### กติกาสไตล์

- สะอาด เป็นทางการ น่าเชื่อถือ — แยกส่วนด้วย **เส้นขอบบาง + พื้นที่ว่าง** ไม่ใช่เงา
- **ห้ามใช้ gradient** ทุกกรณี
- **ห้ามใช้เงาหนา** — อนุญาตเฉพาะเงาบางมากใน dropdown/popover/modal เท่านั้น
- ไม่มี dark mode ในขอบเขตงานนี้
- แอนิเมชันมีได้เฉพาะ transition สั้นๆ (≤150ms) ตอน hover/focus

---

## 5. กติกาการเขียนโค้ด

### ภาษา

- **ข้อความที่ผู้ใช้เห็นทั้งหมดเป็นภาษาไทย** (ปุ่ม, label, error message, อีเมล, empty state)
- **ชื่อตัวแปร ฟังก์ชัน คลาส ไฟล์ ตาราง คอลัมน์ และ comment เป็นภาษาอังกฤษทั้งหมด**
- ข้อความไทยที่ผู้ใช้เห็น รวมไว้ที่เดียวต่อโดเมน (`frontend/src/lib/messages/*.ts`) ไม่กระจายเป็น string ลอยในคอมโพเนนต์

### Naming

| สิ่งของ | รูปแบบ | ตัวอย่าง |
|---|---|---|
| ไฟล์ backend | kebab-case + suffix บทบาท | `top-up.service.ts`, `roles.guard.ts` |
| ไฟล์ frontend component | PascalCase | `CourseCard.tsx` |
| ไฟล์ route ของ Next.js | ตามข้อกำหนดของ framework | `page.tsx`, `layout.tsx` |
| คลาส / type / enum | PascalCase | `TopUpService`, `OrderStatus` |
| ตัวแปร / ฟังก์ชัน | camelCase | `instructorEarningAmount` |
| ค่าใน enum | UPPER_SNAKE_CASE | `PENDING_REVIEW` |
| Prisma model | PascalCase เอกพจน์ | `OrderItem` |
| คอลัมน์ | camelCase | `revenueSharePercent` |
| ฟิลด์จำนวนเงิน | ลงท้ายด้วย `Amount` เสมอ | `platformFeeAmount` |
| ฟิลด์เวลา | ลงท้ายด้วย `At` เสมอ | `approvedAt` |
| ฟิลด์ boolean | ขึ้นต้นด้วย `is`/`has` | `isPreview`, `hasPassed` |
| object key ใน MinIO | `<domain>/<entityId>/<uuid>.<ext>` | `lesson-video/clh.../a1b2.mp4` |

### โครง module ของ backend

หนึ่งโดเมนหนึ่งโฟลเดอร์ใน `src/modules/<domain>/` ประกอบด้วย

```
<domain>.module.ts        ประกาศ module
<domain>.controller.ts    รับ request, ตรวจสิทธิ์, ไม่มี business logic
<domain>.service.ts       business logic ทั้งหมด, เข้าถึง prisma
dto/                      DTO เข้า (class-validator) และ response type ออก
<domain>.service.spec.ts  เทสต์
```

กฎเหล็ก
- **Controller ห้ามแตะ PrismaService โดยตรง** ต้องผ่าน service เสมอ
- **Service ห้ามรู้จัก Request/Response object** ของ HTTP
- service เรียก service ข้ามโดเมนได้ แต่ห้ามเรียกวนกลับ (ถ้าเริ่มวน ให้ยกตรรกะร่วมขึ้นไปเป็น service ใหม่)
- ห้ามใส่ business logic ใน Prisma middleware

### Validation

- Backend: DTO + `class-validator` และเปิด global `ValidationPipe` ด้วย `whitelist: true, forbidNonWhitelisted: true, transform: true` — **input ทุกตัวจาก client ต้องผ่าน DTO ไม่มีข้อยกเว้น**
- Frontend: `react-hook-form` + `zod` สำหรับฟอร์ม (validate ซ้ำเพื่อ UX เท่านั้น — **ความถูกต้องจริงตัดสินที่ backend เสมอ**)
- `packages/shared` เก็บเฉพาะ enum และ response type ไม่มี validation logic ไม่มี runtime dependency

### Error handling

- ใช้ HttpException ของ Nest เท่านั้น (`BadRequestException`, `ForbiddenException`, `NotFoundException`, `ConflictException`, `UnprocessableEntityException`)
- global exception filter แปลงทุก error เป็นรูปแบบเดียว
  `{ statusCode, code, message, details?, timestamp, path }`
  โดย `code` เป็นรหัสภาษาอังกฤษ UPPER_SNAKE (เช่น `INSUFFICIENT_WALLET_BALANCE`) และ `message` เป็นข้อความไทยที่แสดงต่อผู้ใช้ได้ทันที
- ห้าม `catch` แล้วกลืน error เงียบๆ — ถ้า catch ต้อง log ด้วย logger ของ Nest แล้ว throw ต่อหรือแปลงเป็น HttpException ที่สื่อความหมาย
- ห้ามส่ง stack trace / ข้อความจาก Prisma ดิบๆ ออกไปหา client
- ฝั่ง frontend: อ่าน `code` เพื่อตัดสินใจ flow และแสดง `message` ให้ผู้ใช้

### เรื่องเงิน (สำคัญที่สุดของโปรเจกต์นี้)

- ทุกจำนวนเงินเป็น `Decimal @db.Decimal(12, 2)` · เปอร์เซ็นต์ส่วนแบ่งเป็น `Decimal @db.Decimal(5, 2)`
- คำนวณด้วย Decimal เท่านั้น **ห้ามแปลงเป็น `number` ระหว่างทางเด็ดขาด** แม้แต่ชั่วคราว
- API ส่งจำนวนเงินออกเป็น **string** (เช่น `"1250.00"`) ไม่ใช่ number — กัน float precision หลุดตอน JSON
- Frontend แสดงผลด้วย `Intl.NumberFormat('th-TH')` ผ่าน helper กลางตัวเดียว
- ปัดเศษ: ค่าธรรมเนียมแพลตฟอร์มปัด 2 ตำแหน่งแบบ **half-up** แล้ว **รายได้ผู้สอน = ราคา − ค่าธรรมเนียม** (คำนวณจากส่วนต่างเสมอ เพื่อให้ผลรวมลงตัวพอดี ไม่มีเศษหาย)

### Double-entry ledger

- ผังบัญชี: `PLATFORM_CASH` (ASSET) · `USER_WALLET:<userId>` (LIABILITY) · `INSTRUCTOR_PAYABLE:<userId>` (LIABILITY) · `PLATFORM_REVENUE` (REVENUE)
- ทุกธุรกรรมสร้าง `LedgerTransaction` 1 ใบ พร้อม `LedgerEntry` ≥ 2 แถว และ **ผลรวม DEBIT ต้องเท่ากับผลรวม CREDIT เป๊ะ** ตรวจในโค้ดก่อน commit ทุกครั้ง
- `Wallet.balance` และยอดคงค้างผู้สอนเป็น **ยอดสรุปที่ต้องอัปเดตใน transaction เดียวกับ ledger เสมอ** ledger คือความจริง ยอดสรุปคือ cache
- ทุก service ที่แตะเงินต้องอยู่ใน `prisma.$transaction` และต้อง **ล็อกแถว wallet ด้วย `SELECT ... FOR UPDATE`** ก่อนอ่านยอดไปคำนวณ
- ห้ามลบหรือแก้ `LedgerEntry` ที่บันทึกแล้ว — แก้ผิดด้วยการบันทึกรายการกลับรายการ (reversal) เท่านั้น
- `LedgerTransaction` ต้องมี `idempotencyKey` unique กันการกดซ้ำ/ยิงซ้ำ

### Snapshot

ข้อมูลต่อไปนี้ต้อง copy เก็บไว้ ณ เวลาที่เกิดรายการ ห้าม join ไปอ่านค่าปัจจุบัน
- `OrderItem`: ชื่อคอร์ส, ราคา, เปอร์เซ็นต์ส่วนแบ่ง, ค่าธรรมเนียมแพลตฟอร์ม, รายได้ผู้สอน, instructorId
- `PayoutRequest`: ข้อมูลบัญชีธนาคารของผู้สอน
- `Certificate`: ชื่อผู้เรียน, ชื่อคอร์ส, ชื่อผู้สอน ณ วันที่ออกใบ

เหตุผล: ราคาคอร์สและอัตราส่วนแบ่งแก้ไขทีหลังได้ ถ้าไม่ snapshot รายงานย้อนหลังจะเพี้ยนทั้งหมด

### Auth และสิทธิ์

- access token อายุ 15 นาที · refresh token อายุ 7 วัน · ทั้งคู่อยู่ใน httpOnly + sameSite=lax cookie (`secure` เมื่อ production)
- refresh token ต้องเก็บแบบ hash ใน DB และ **หมุน (rotate) ทุกครั้งที่ใช้** ตัวเก่าถือเป็นใช้แล้วทันที
- ตรวจสิทธิ์ 2 ชั้นเสมอ: (1) `@Roles(...)` ตรวจบทบาท (2) ตรวจความเป็นเจ้าของทรัพยากรใน service เช่น "คอร์สนี้เป็นของ instructor คนนี้จริงไหม" / "ผู้ใช้คนนี้ลงทะเบียนคอร์สนี้แล้วจริงไหม"
- **ห้ามเชื่อ `userId`, `role`, `price` ที่ส่งมาจาก body ของ client เด็ดขาด** ต้องอ่านจาก JWT / จาก DB เท่านั้น
- ทุก endpoint ต้องระบุสิทธิ์ชัดเจน default คือ "ต้อง login" — endpoint สาธารณะต้องประกาศ `@Public()` อย่างจงใจ

### ไฟล์และวิดีโอ

- อัปโหลด: client ขอ **presigned PUT URL** จาก backend แล้วยิงเข้า MinIO ตรง (ไฟล์ไม่ผ่าน backend)
- ดูวิดีโอบทเรียน: **proxy stream ผ่าน NestJS** (`GET /lessons/:id/stream`) รองรับ HTTP Range header — ทุก request ตรวจ JWT + ตรวจว่าลงทะเบียนคอร์สแล้ว (หรือบทเรียนนั้นเป็น preview) **ห้ามส่ง presigned GET URL ของวิดีโอบทเรียนออกไปหา client** เพราะจะแชร์ต่อได้
- เอกสารแนบและสลิป: ใช้ presigned GET หลังตรวจสิทธิ์แล้ว อายุตาม `MINIO_PRESIGN_EXPIRY_SECONDS` (ค่าปัจจุบัน 1 ชั่วโมง)
- ตรวจ MIME type และขนาดไฟล์ที่ backend ก่อนออก presigned URL เสมอ
  ค่าจริงอยู่ใน `.env` (`UPLOAD_MAX_*`): วิดีโอ ≤ 500MB · เอกสาร ≤ 50MB · รูปและสลิป ≤ 5MB
  ตารางชนิดไฟล์ที่รับและบทบาทที่อัปโหลดได้อยู่ที่ `src/modules/uploads/upload-rules.ts` ที่เดียว

### Git

- commit ภาษาอังกฤษ รูปแบบ `<type>(<scope>): <subject>` เช่น `feat(wallet): add top-up approval flow`
- type ที่ใช้: `feat` `fix` `refactor` `test` `docs` `chore`
- หนึ่ง commit หนึ่งความหมาย ห้ามรวมงานหลายเฟสไว้ commit เดียว

---

## 6. คำสั่งที่ใช้บ่อย

รันจาก root ของ workspace เสมอ

```bash
# ครั้งแรก
pnpm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
pnpm docker:up
pnpm db:migrate
pnpm db:seed

# ประจำวัน
pnpm dev                  # รัน backend + frontend พร้อมกัน
pnpm dev:be               # backend อย่างเดียว (:4000)
pnpm dev:fe               # frontend อย่างเดียว (:3000)

# Docker
pnpm docker:up            # postgres + minio + mailhog
pnpm docker:down
pnpm docker:reset         # ลบ volume แล้วยกใหม่ (ข้อมูลหายทั้งหมด)

# ฐานข้อมูล
pnpm db:migrate           # prisma migrate dev
pnpm db:migrate:name      # ตั้งชื่อ migration
pnpm db:reset             # ล้าง DB + migrate ใหม่ + seed
pnpm db:seed
pnpm db:studio            # Prisma Studio

# คุณภาพโค้ด
pnpm test                 # Vitest ทั้งหมด
pnpm test:watch
pnpm test:e2e             # Playwright (มีตั้งแต่เฟส 8)
pnpm lint
pnpm typecheck            # ต้องผ่านทั้ง backend และ frontend
pnpm build
```

URL ที่ใช้ตอน dev
- เว็บ: http://localhost:3000
- API: http://localhost:4000/api
- MinIO Console: http://localhost:9001
- Mailhog: http://localhost:8025
- Prisma Studio: http://localhost:5555

---

## 7. ข้อห้ามเด็ดขาด

**เรื่องเงิน**
1. ห้ามใช้ `Float` หรือ JS `number` กับข้อมูลการเงินทุกกรณี ใช้ `Decimal` เท่านั้น
2. ห้ามอัปเดตยอด wallet โดยไม่บันทึก ledger entry คู่กันใน transaction เดียวกัน
3. ห้ามให้ service ที่แตะเงินทำงานนอก `prisma.$transaction`
4. ห้ามอ่านราคาหรืออัตราส่วนแบ่งจากตารางปัจจุบันเพื่อทำรายงานย้อนหลัง ต้องอ่านจาก snapshot
5. ห้ามลบหรือ UPDATE แถวใน `LedgerEntry` / `LedgerTransaction` ที่บันทึกแล้ว
6. ห้ามอนุมัติเติมเงินหรือถอนเงินจาก endpoint ที่ไม่ใช่บทบาท ADMIN

**เรื่องฐานข้อมูล (เพิ่มหลังเหตุการณ์จริงที่ข้อมูล dev ถูกเขียนทับ)**

6.1 **ทุกคำสั่งที่เขียนข้อมูล (`seed`, `reset`, `migrate`, `demo`, `db push`, Prisma Studio)
   ต้อง echo ชื่อฐานข้อมูลปลายทางออกมาก่อนรันเสมอ** ไม่ว่าจะรันบน host หรือใน container
   ตัวอย่าง: `echo "$DATABASE_URL" | sed 's|.*/||; s|?.*||'`
6.2 **ถ้าปลายทางคือ `getownly` ต้องหยุดถามผู้ใช้ก่อนทุกครั้ง ห้ามรันเอง**
   `getownly_test` และ `getownly_docker` รันได้เลย เพราะเป็นฐานข้อมูลใช้แล้วทิ้ง
6.3 **ข้อ 6.1–6.2 ใช้กับคำสั่งใน container ด้วย** — `docker compose exec api ... seed`
   เขียนข้อมูลได้เหมือนกันทุกประการ และ**ข้ามด่านขออนุญาตของ Prisma ที่ทำงานบน host เท่านั้น**
   เคยเกิดขึ้นจริง: ตอนพิสูจน์ Docker profile `full` คำสั่ง seed ใน container เขียนทับ `getownly`
   โดยไม่มีอะไรเตือน เพราะ compose ชี้ `DATABASE_URL` ไปที่นั่นโดยปริยาย
   แก้แล้วด้วยการให้ profile `full` ใช้ `getownly_docker` และมี `db-init` ที่ **ปฏิเสธถ้าถูกตั้งให้ชี้ `getownly`**
6.4 **`pnpm docker:reset` ลบ volume ของ postgres** ข้อมูลใน `getownly` หายทั้งหมด
   ชื่อคำสั่งไม่ได้บอกแบบนั้น ให้ถือว่าอยู่ในข้อ 6.2

**เรื่องความปลอดภัย**

7. ห้ามเชื่อค่าใดๆ จาก client ที่กำหนดสิทธิ์หรือราคา (`userId`, `role`, `price`, `revenueShare`, `orderTotal`)
8. ห้ามเก็บ JWT ใน localStorage — httpOnly cookie เท่านั้น
9. ห้าม commit `.env`, ไฟล์ secret, หรือ dump ฐานข้อมูล
10. ห้ามส่ง presigned GET URL ของวิดีโอบทเรียนออกไปหา client
11. ห้ามคืนค่า `passwordHash`, refresh token, หรืออีเมลผู้ใช้อื่นใน API response — ทุก response ต้องผ่าน mapper ที่เลือกฟิลด์อย่างจงใจ (ห้าม `return user` ดิบ)

**เรื่องขอบเขตและความซับซ้อน (ผู้พัฒนาคนเดียว)**

12. ห้ามเพิ่ม dependency ใหญ่ (Redis, message queue, microservice, GraphQL, state manager ตัวใหม่, auth provider ภายนอก) โดยไม่ถามก่อน
13. ห้ามทำ transcode วิดีโอ / HLS / adaptive bitrate — เก็บ MP4 แล้ว proxy stream ตามที่ตัดสินใจไว้
14. ห้ามเริ่มเฟสถัดไปก่อนที่เกณฑ์ตรวจรับของเฟสปัจจุบันจะผ่านครบ
15. ห้ามทำฟีเจอร์ที่ระบุว่า out of scope ใน PLAN.md โดยไม่ถามก่อน
16. ห้ามสร้างชั้น abstraction ที่ยังไม่มีผู้ใช้จริง (generic repository, base CRUD service, plugin system) — เขียนตรงๆ ไปก่อน

**เรื่อง UI**

17. ห้าม hardcode ค่าสีในคอมโพเนนต์ ใช้ token จากข้อ 4 เท่านั้น
18. ห้ามใช้ gradient และห้ามใช้เงาหนา
19. ห้ามมีข้อความภาษาอังกฤษหลุดในหน้าจอผู้ใช้ (ยกเว้นชื่อเฉพาะและหน่วยเทคนิค)

---

## 8. หมายเหตุสำหรับ session ถัดไป

**สถานะ: เฟส 1–8 ทำครบตามขอบเขตที่ตกลงกันไว้ในแต่ละรอบ**
เฟส 3 ได้คิวอนุมัติคอร์สแล้วในเฟส 8 · เฟส 4 ยังขาดอีเมลแจ้งผลตรวจสลิป · เฟส 5 ยังไม่มีตะกร้าและ Order/OrderItem ·
เฟส 6 ยังไม่มีใบประกาศนียบัตรและหน้าจอสร้างข้อสอบของผู้สอน · เฟส 7 ยังไม่มีรีวิว การถอนเงิน และการแจ้งเตือน ·
เฟส 8 ยังไม่มี Playwright e2e การส่งออก CSV และ AuditLog
**ถัดไปที่คุ้มที่สุด: ตะกร้า/checkout · การถอนเงินของผู้สอน · รีวิว · ใบประกาศนียบัตร**

### หน้าจอสร้างแบบทดสอบ และ snapshot เกณฑ์ผ่าน (ทก.01 A7)

**กติกาใหม่: ชุดที่มีคนทำแล้ว แก้ชื่อและเกณฑ์ผ่านได้เสมอ แต่คำถาม/ตัวเลือก/เฉลย แช่แข็ง และลบไม่ได้**
เดิมแช่แข็งทั้งใบ ซึ่งปลอดภัยแต่โหดเกินไป: พิมพ์ผิดหนึ่งตัว + มีคนทำหนึ่งคน = แก้ไม่ได้ตลอดกาล

- **`QuizAttempt.passScoreSnapshot`** (migration `20260908014500_...`) — พอเกณฑ์ผ่านขยับได้ ผลที่บันทึกไว้แล้ว
  จะ derive จากค่าปัจจุบันไม่ได้อีก หลักการเดียวกับ `Enrollment.commissionRateSnapshot`
  **backfill จาก `Quiz.passScore` ถูกต้องแบบพิสูจน์ได้ ไม่ใช่การเดา** เพราะกติกาเดิมแช่แข็งทั้งใบ
  เกณฑ์ผ่านจึงขยับไม่ได้เลยนับตั้งแต่มีคนทำครั้งแรก ค่าปัจจุบัน**คือ**ค่าที่ทุก attempt เดิมถูกตัดสินด้วย
- **`backend/src/common/quiz-scoring.ts` เป็นที่เดียวที่ตัดสินผ่าน/ไม่ผ่าน** เดิมมีสูตรนี้ **4 ที่**
  (`learn.service` toQuizSummary, `quizzes.service` readStanding, `quizzes.service` listMyAttempts,
  `course-students.service` A9) ทั้งสี่เรียก `summariseAttempts()` แล้ว
- **`bestScore` กับ `hasPassed` เป็นคนละข้อเท็จจริงกัน** พอเกณฑ์ขยับได้ สองอย่างนี้เลิกตรงกัน:
  ได้ 65 ตอนเกณฑ์ 60 = ผ่าน · ขึ้นเกณฑ์เป็น 70 ทีหลังไม่ทำให้กลายเป็นไม่ผ่าน · แต่ 65 ใหม่ที่เกณฑ์ 70 = ไม่ผ่าน
  **`hasPassed` จึงแปลว่า "เคยผ่านหรือยัง" ไม่ใช่ "คะแนนสูงสุดเกินเกณฑ์ปัจจุบันไหม"**
- **A9 ใช้ groupBy เพิ่มอีกใบ (7 → 8 query ต่อหน้า ยังคงที่)** เพราะ SQL aggregate เขียน
  "มี attempt ไหนที่ผ่านเกณฑ์ของตัวเองบ้าง" ไม่ได้ · ใบใหม่กรอง `passed: true` ซึ่งเป็นคำตัดสินที่บันทึกไว้
  ตอนทำข้อสอบ ไม่ใช่การตัดสินใหม่
- **`src/common/quiz-scoring.spec.ts` อ่านซอร์สทุกไฟล์ใต้ `src/`** แล้ว fail ถ้ามีใครเขียน
  `score >= quiz.passScore` ขึ้นมาใหม่ — กันการถอยกลับ ไม่ใช่แค่ทดสอบพฤติกรรมปัจจุบัน
- **ตัวตรวจฝั่ง backend ที่เพิ่ม**: ตัวเลือกซ้ำในข้อเดียวกัน (เทียบหลัง trim) · `@Trim()` บนทุก text field
  ทำให้ช่องที่มีแต่ช่องว่างกลายเป็นว่างจริงก่อนวัดความยาว · `QuizQuestionInvalidException` บอก
  **ข้อที่เท่าไรและผิดเรื่องอะไร** (`NO_CORRECT_CHOICE`/`MANY_CORRECT_CHOICES`/`DUPLICATE_CHOICE`)
  ไม่ใช่ "ข้อมูลไม่ถูกต้อง" ลอยๆ · `details.questionIndex` ให้หน้าเว็บชี้การ์ดที่ผิดได้
- **`GET /quizzes/:id` เป็นของใหม่** เดิมไม่มีทางให้ผู้สอนอ่านชุดพร้อมเฉลยกลับมาเลย
  (create/update คืนมาให้ตอนบันทึกเท่านั้น) หน้าแก้ไขจึงเปิดของเดิมไม่ได้
- **`LessonDto.quiz` เพิ่มเข้ามา** (id, title, passScore, questionCount, attemptCount)
  แท็บแบบทดสอบจึงยิงครั้งเดียวได้ทั้งรายการบทเรียนและสถานะแบบทดสอบของแต่ละบท
- **หน้าจอ: `QuizzesTab.tsx` แทนที่ empty state เดิม ไม่ได้เพิ่มหน้าใหม่คู่กัน**
  ไล่ตาม**บทเรียน**ไม่ใช่ตามแบบทดสอบ เพราะแบบทดสอบไม่มีตัวตนแยกจากบทที่มันปิดท้าย
  · `QuizForm.tsx` ใช้ `<input type="radio">` หนึ่งกลุ่มต่อหนึ่งข้อ — กติกา "ถูกได้ข้อเดียว"
  จึงถูกบังคับด้วยตัว widget เอง ไม่ต้องไปตรวจทีหลัง
  · ลบตัวเลือกที่เป็นเฉลยอยู่ → ตัวแรกที่เหลือรับเฉลยไปแทน ฟอร์มจึงไม่เคยเข้าสถานะที่ API จะปฏิเสธ
  · ชุดที่ถูกแช่แข็ง: ฟิลด์คำถาม/ตัวเลือกเป็น `readOnly` **พร้อมแบนเนอร์อธิบายเหตุผลและจำนวนครั้งที่มีคนทำ**
  ปุ่มลบ disabled พร้อม tooltip เหตุผลเดียวกัน
  · แก้ค้างแล้วปิดแท็บ → `beforeunload` เตือน · กดยกเลิก → `confirm()` เตือน
- **ตรวจจริงที่ 375 / 768 / 1440 ด้วย Playwright แล้วสำหรับแท็บนี้** (ต่อ backend เข้า `getownly_test`
  ไม่แตะฐานข้อมูล dev) ไม่มี horizontal overflow ที่ความกว้างใดเลย ทั้งหน้ารายการ ฟอร์มสร้าง และฟอร์มที่ถูกแช่แข็ง
- **เทสต์ของรอบนี้รวม 32 ข้อ**: `test/quiz-authoring.e2e.spec.ts` ใหม่ 13 (ยิง HTTP จริงทั้งหมด) ·
  `quizzes.service.spec.ts` เพิ่ม 6 · `course-students.service.spec.ts` เพิ่ม 4 ·
  `src/common/quiz-scoring.spec.ts` ใหม่ 6 · `test/quiz-pass-score-backfill.spec.ts` ใหม่ 2 ·
  `lessons.service.spec.ts` เพิ่ม 2 (บั๊กลบบทเรียน) — **รวมทั้งชุด 402 ข้อ**

### บั๊กที่แก้พร้อมกัน: ลบบทเรียนที่มีข้อสอบซึ่งมีคนทำแล้ว → 500

`LessonsService.remove` เช็คแค่ `LessonProgress` แต่**การทำข้อสอบไม่สร้าง `LessonProgress`**
(สร้างจากการเล่นวิดีโอเท่านั้น) บทเรียนที่ไม่มีวิดีโอจึงมีข้อสอบที่คนทำแล้วได้โดยที่ด่านเดิมมองไม่เห็น
พอ `lesson.delete()` ชน RESTRICT ของ `QuizAttemptAnswer.questionId` Prisma โยน `P2003` ซึ่ง
`AllExceptionsFilter` map เฉพาะ `P2002` → ออกมาเป็น **500 "เกิดข้อผิดพลาดภายในระบบ"**
ข้อมูลไม่เคยเสียหาย (rollback) แต่หน้าจอบอกผิด · แก้ด้วย `LessonQuizHasAttemptsException` (409) ที่บอกจำนวนครั้ง

**ไล่ delete path อื่นครบแล้ว ไม่มีรูแบบเดียวกันอีก** (ดูสรุปในรายงานกลุ่ม 3)

### รายชื่อผู้เรียน ความก้าวหน้า และคะแนนรายคอร์ส (ทก.01 A9)

`GET /instructor/courses/:id/students` — `InstructorCoursesController` ใหม่ในโฟลเดอร์ `courses/`
คู่กับ `CourseStudentsService` · pagination 20/หน้า เรียง `enrolledAt DESC, id DESC`

- **`backend/src/common/progress.ts` เป็นที่เดียวที่คำนวณ % ความก้าวหน้าแล้ว** — ก่อนหน้านี้สูตรเดียวกันถูกเขียนไว้ **3 ที่**
  (`percentOf()` ใน `learn.service.ts` ใช้ 2 จุด และเขียนสดอีกครั้งใน `enrollments.service.ts`)
  ทั้งสามที่ถูกเปลี่ยนมาเรียก `courseProgressPercent()` ตัวเดียวกัน · **มีเทสต์ที่เรียก `students.listForCourse()`
  กับ `learn.getRoom()` ในเทสต์เดียวแล้วเทียบตัวเลขตรงๆ** เพื่อกันไม่ให้ผู้สอนกับผู้เรียนเห็นคนละเลข
  วางไว้ที่ `common/` ไม่ใช่ `learn/` เพราะ `courses` import `learn` จะเป็นวงกลม (`learn` import `CourseAccessService` อยู่แล้ว)
- **`CourseStudentsService` ไม่ตรวจสิทธิ์เอง** controller เรียก `CourseAccessService.assertCourseOwner()` ก่อน
  และทุก query ผูกกับ `courseId` อยู่แล้ว จึงไม่มีอะไรที่คลาสนี้เอื้อมถึงได้เกินกว่าที่ผู้เรียกมีสิทธิ์อยู่แล้ว
  แยกจาก `CoursesService` ด้วยเหตุผลเดียวกับ `CourseReviewService`: มันตอบคนละคำถาม
- **8 SQL statement ต่อหนึ่งหน้า ไม่ว่าจะ 1 คนหรือ 20 คน** (วัดจริงด้วย Prisma query log)
  หัวใจคือสองตัวที่จะกลายเป็น N+1 ถูกทำเป็น `groupBy` ครอบทั้งหน้าในครั้งเดียว:
  `lessonProgress.groupBy(['enrollmentId'])` และ `quizAttempt.groupBy(['studentId','quizId'])` ที่ `_max: { score }`
- **`bestScore: null` = ยังไม่เคยทำ ต่างจากทำแล้วได้ 0** สองอย่างนี้ความหมายตรงข้ามกันสำหรับผู้สอนที่กำลังดูว่าบทเรียนเข้าใจง่ายไหม
  หน้าจอขึ้น "ยังไม่ทำ" กับ "0%" คนละแบบ · **คะแนนที่แสดงคือคะแนนสูงสุด ไม่ใช่ครั้งล่าสุด** (`_max: { score }`)
  ตรงกับที่ `LearnService.readQuizStandings()` ตัดสิน `hasPassed` อยู่แล้ว
- **นับผู้เรียนที่ลงทะเบียนฟรีด้วย** ต่างจากตาราง A10 ที่มีแต่รายการที่มีเงินเคลื่อนไหว — รายชื่อนี้ตอบว่า "ใครกำลังเรียน"
  ไม่ใช่ "ใครจ่ายเงิน" · **ผู้เรียนที่ถูกระงับบัญชียังอยู่ในรายชื่อ** เพราะเขาลงทะเบียนจริงและยอดขายเกิดขึ้นจริงแล้ว
  ถ้าซ่อนไป รายชื่อจะขัดกับตารางรายได้ว่ามีคนซื้อกี่คน (มีเทสต์ทั้งสองข้อ)
- **ไม่มีอีเมลหรือช่องทางติดต่อใน payload เลย** ทก.01 ให้สิทธิ์ "เรียกดูรายชื่อผู้เรียน" ไม่ใช่ "ติดต่อผู้เรียน"
  มีเทสต์ที่ assert ว่า JSON ทั้งก้อนไม่มี `@` และไม่มี field `email`/`username`
- **คะแนนรายชุดเดินทางมาพร้อมแต่ละแถวเลย ไม่ได้ยิง request ที่สองตอนกางแถว** ข้อมูลเล็กมาก
  (20 คน × จำนวนชุดในคอร์ส) และการกางแถวแล้วต้องรอเน็ตทำให้รู้สึกเหมือนเว็บค้าง
- **หน้าจอเป็นแท็บที่ 4 ในหน้าแก้ไขคอร์ส (`StudentsTab.tsx`)** ไม่ได้ทำหน้าใหม่ เพราะ `/instructor/courses/[id]`
  เป็นหน้าเดียวฝั่งผู้สอนที่ผูกกับคอร์สเดียวอยู่แล้ว ถ้าไปวางบน dashboard จะต้องมีตัวเลือกคอร์สซึ่ง URL นี้เป็นอยู่แล้ว
- **มือถือยุบเป็นการ์ดต่อคน (`md:hidden`)** ตามแนวเดียวกับตาราง A10 · แถวในตารางกางได้ด้วยการคลิกทั้งแถวหรือปุ่ม chevron
- **เทสต์: `course-students.service.spec.ts` ใหม่ 13 ข้อ และ `test/course-students.e2e.spec.ts` ใหม่ 5 ข้อ**
  รวมทั้งชุด **370 ข้อ**

### รายละเอียดการคำนวณส่วนแบ่งรายธุรกรรม (ทก.01 A10)

`GET /instructor/reports/transactions` — ต่อกับ `InstructorReportsController` เดิม ไม่ได้ตั้ง controller ใหม่
คืน 4 ค่าตามเอกสารต่อหนึ่งรายการขาย: ราคาขาย / อัตราส่วนแบ่ง ณ เวลานั้น / จำนวนที่ถูกหัก / ยอดสุทธิ

- **ทั้ง 4 ค่าเป็นค่าที่ "อ่าน" ไม่ใช่ "คำนวณใหม่"** สามค่าเป็นผลรวมของ `LedgerEntry` ที่ธุรกรรมนั้นเขียนไว้
  (แยกด้วย `direction` + `account.kind` แบบเดียวกับรายงานอื่นทั้งหมด) ส่วนอัตราส่วนแบ่งมาจาก
  `Enrollment.commissionRateSnapshot` · **ห้ามอ่าน `User.commissionRate` ปัจจุบันมาแสดงเด็ดขาด**
  ถ้าคูณราคา × อัตราปัจจุบัน ตัวเลขในรายงานย้อนหลังจะขยับทุกครั้งที่ ADMIN แก้อัตรา ซึ่งเป็นสิ่งที่ snapshot มีไว้ป้องกัน
- **`EARNING_SUMS` เป็น `Prisma.sql` ที่ใช้ร่วมกันระหว่าง query รายแถวกับ query ยอดรวม** ยอดรวมใต้ตาราง
  จึงไม่มีทางถูกบวกด้วยกติกาคนละชุดกับแถวข้างบน · `totals` ครอบทุกแถวที่ตรงตัวกรอง ไม่ใช่แค่หน้าที่กำลังแสดง
- **ขอบเขตข้อมูลอยู่ใน `WHERE` (`c."instructorId" = ...`) ไม่ใช่กรองผลลัพธ์ทีหลัง** จึงไม่มีรูปแบบการเรียกไหน
  ที่อ่านยอดขายของผู้สอนคนอื่นได้ · เมื่อส่ง `courseId` มาด้วย controller เรียก `CourseAccessService.assertCourseOwner()`
  ก่อน เพื่อให้ id ของคนอื่นได้ **403 `NOT_COURSE_OWNER` แทนตารางว่าง** — ตารางว่างอ่านได้ว่า "คอร์สนี้ยังไม่เคยขาย"
  ซึ่งเป็นข้อมูลของคนอื่น · `ReportsModule` จึง `imports: [CoursesModule]`
- **คอร์สฟรีไม่ปรากฏในตารางนี้** เพราะ join เริ่มจาก `LedgerTransaction` และคอร์สฟรีไม่เขียน ledger เลย (มีเทสต์ยืนยัน)
- **`ORDER BY lt."createdAt" DESC, lt.id DESC`** ใส่ `id` เป็นตัวตัดสินรอง ด้วยเหตุผลเดียวกับ `GET /wallet`
  สองรายการใน ms เดียวกันจะสลับที่ระหว่างหน้าจนรายการหนึ่งโผล่สองหน้าและอีกรายการหาย
- **ยืนยันแล้วว่า `wallet.service.ts` ปัดเศษตรงกติกาอยู่ก่อนแล้ว** (`platformAmount = round(price × rate, 2)` half-up
  แล้ว `instructorAmount = price − platformAmount`) จึงไม่ต้องแก้และข้อมูลเดิมไม่กระทบ · เทสต์ยึดเคส
  rate 0.1750 ราคา 999 → หัก 174.83 สุทธิ 824.17
- **หน้าจอ: `EarningsTable.tsx` โหลดข้อมูลของตัวเองแยกจาก `InstructorReportsView`** เพราะมันแบ่งหน้าและมีตัวกรอง
  ส่วนการ์ดด้านบนเป็น snapshot ครั้งเดียว · dropdown เลือกคอร์สใช้ `data.courses` ที่โหลดมาแล้ว ไม่ยิง API เพิ่ม
- **มือถือ (`md:hidden`) ยุบเป็นการ์ดต่อรายการ ไม่ใช่ตารางเลื่อนแนวนอน** หกคอลัมน์อ่านไม่ได้ที่ 375px และตารางที่เลื่อนได้
  จะซ่อนคอลัมน์ "ยอดสุทธิ" ซึ่งเป็นคอลัมน์ที่ผู้สอนเปิดหน้านี้มาดู
- **`formatRatePercent()` ใน `lib/format.ts`** เป็นที่เดียวที่แปลง "0.1750" → "17.50%" · เงินยังใช้ `formatBaht()` ตามเดิม
- **เทสต์: `reports.service.spec.ts` เพิ่ม 12 ข้อ และ `test/instructor-earnings.e2e.spec.ts` ใหม่ 6 ข้อ**
  (ยิง HTTP จริงผ่าน `createHarness()` ผู้สอน A ต้องไม่เห็นของผู้สอน B) รวมทั้งชุด **352 ข้อ**

### Docker profile `full` และสคริปต์ตรวจ responsive ที่รันซ้ำได้

- **`docker compose --profile full up` ยกทั้งระบบรวมแอป** (ทก.01 ข้อ 2.7.4) ส่วน `pnpm docker:up` เดิม
  ยังยกเฉพาะ postgres/minio/mailhog เหมือนเดิม · profile **เพิ่มคอนเทนเนอร์เท่านั้น ไม่แก้ของเดิม**
  สองโหมดจึงไม่กวนกัน (แต่ใช้พอร์ตชุดเดียวกัน จึงรันพร้อมกันไม่ได้)
- **Dockerfile ต้อง build จาก root ของ workspace** ไม่ใช่จากโฟลเดอร์ของแต่ละแพ็กเกจ
  เพราะทั้งสองแพ็กเกจพึ่ง `@getownly/shared` ที่ resolve ผ่าน `pnpm-workspace.yaml`
  · ใช้ `node:22-slim` ไม่ใช่ alpine เพราะ bcrypt เป็น native module และ Prisma ต้องการ OpenSSL
- **runtime stage คัดลอก `/app` ทั้งก้อน ไม่ตัดทิ้ง** เพราะ node_modules ของ pnpm เป็น symlink farm
  ชี้เข้า `.pnpm` การคัดลอกทีละส่วนได้ image ที่ติดตั้งดูเหมือนสำเร็จแล้ว resolve ไม่ได้ตอนรัน
  ยอมให้ image ใหญ่แลกกับ image ที่สตาร์ตได้จริง
- **ไม่เปิด corepack ใน runtime stage** ถ้าเปิด คอนเทนเนอร์จะดาวน์โหลด pnpm ตอนสตาร์ตครั้งแรก
  ซึ่งจะพังถ้าเครื่องไม่มีเน็ตในวันสอบ · เรียก binary ตรงๆ ที่ `node_modules/.bin/` แทน
  · **`prisma` อยู่ที่ `backend/node_modules/` ไม่ใช่ root** (เป็น devDependency ของ backend)
- **`prisma migrate deploy` รันตอน API สตาร์ต** `--profile full` กับฐานข้อมูลว่างจึงใช้ได้เลย
  ไม่ต้องมีขั้นตอนที่สอง · `db seed` ใน container ต้องเรียก `node_modules/.bin/tsx prisma/seed.ts` ตรงๆ
  เพราะ `prisma db seed` จะ spawn `tsx` จาก PATH ซึ่งไม่มีในคอนเทนเนอร์
- **⚠️ บั๊กความปลอดภัยที่เจอตอนทำ: `.env` จริงของเครื่องหลุดเข้า image**
  `.dockerignore` เขียน `.env` เฉยๆ ซึ่งจับแค่ระดับ root **ไม่จับ `backend/.env`**
  ไฟล์ที่มี JWT secret และเลขพร้อมเพย์จริงจึงถูกคัดลอกเข้าไปด้วย
  แก้เป็น `**/.env` และ `**/.env.*` พร้อม `!**/.env.example` · ยืนยันแล้วว่าหายไปจาก image
- **ค่าที่ขึ้นต้น `NEXT_PUBLIC_` ต้องส่งเป็น build arg ไม่ใช่ environment ตอนรัน** เพราะ Next ฝังลง bundle
  ตอน build · ส่วน `API_BASE_URL` (ไม่มี prefix) เป็น runtime env เพราะ Server Component เรียกผ่าน
  เครือข่ายภายใน (`api:4000`) ขณะที่เบราว์เซอร์ยังเรียก `localhost:4000`
- **พิสูจน์ด้วยการยกจริงแล้ว** ไม่ได้ดูแค่ build ผ่าน: migration 12 ใบรันเอง · seed ผ่าน container ได้ ·
  เปิดเว็บผ่าน container แล้วล็อกอิน เข้าหน้าผู้สอน และหน้ารายงานได้ ไม่มี error ใน console
- **`pnpm test:responsive`** (`frontend/test/responsive.mjs`) เก็บเข้า repo แล้ว
  · `playwright-core` **ไม่ดาวน์โหลดเบราว์เซอร์** แต่ไปหา Chromium/Edge/Chrome ที่เครื่องมีอยู่
  · **แยกความรุนแรง**: `OVERFLOW`/`OFFSCREEN`/`TABLE` ทำให้ exit 1 ส่วน `SMALL` เป็นแค่คำเตือน
  เพราะลิงก์ข้อความย่อมเตี้ยกว่าปุ่มเสมอ ถ้าให้ตกด้วยสคริปต์จะแดงตลอดจนไม่มีใครสนใจ

### ตรวจ Responsive จริง (ทก.01 D8) และเอกสารปิด audit

- **`SCOPE_COMPLIANCE.md` ที่ root** เทียบ ทก.01 ทุกข้อ (A1–D9 รวม 37 ข้อ) กับสิ่งที่ระบบทำได้
  พร้อมไฟล์/endpoint ที่รองรับ · ตัวเลขที่เอกสารกำหนดเทียบกับที่บังคับจริงและบังคับกี่ชั้น ·
  รายการที่จงใจไม่ทำเพราะนอกขอบเขต · สิ่งที่เทสต์พิสูจน์เชิงวิชาการ · เขียนภาษาไทยให้คนที่ไม่ได้อ่านโค้ดอ่านได้
- **ตรวจ 84 หน้าจอ (28 หน้า × 3 ความกว้าง) ด้วย Playwright ต่อ `getownly_test`** ไม่แตะฐานข้อมูล dev
  เกณฑ์ตรวจไม่ใช่แค่ล้นขอบจอ แต่รวม element ที่หลุดนอก viewport และปุ่มที่เตี้ยกว่า 36px ที่ 375px
- **พบข้อบกพร่องเชิงโครงสร้าง 5 จุด อาการเดียวกันหมด**: ตารางที่คอลัมน์ปุ่มสั่งการหลุดออกนอกจอ
  (`/admin/topups` · `/admin/users` · `/admin/categories` · `/instructor` · `/wallet/topup`)
  โดย `/wallet/topup` หนักสุดเพราะดันทั้งหน้าเป็น 543px ในจอ 375px
  **แก้ทั้งห้าด้วยการยุบเป็นการ์ดรายรายการ** แบบเดียวกับที่ `EarningsTable` และ `StudentsTab` ทำไว้
  · ตรวจซ้ำแล้วผ่านครบ · **บทเรียน: ทุกครั้งที่เพิ่มคอลัมน์ในตาราง ต้องดูจอเล็กด้วย**
  (คอลัมน์ "รอมาแล้ว" ที่เพิ่มในกลุ่ม 4 เป็นตัวดัน `/admin/topups` ให้พัง)
- **กับดักที่เจอสองครั้ง: รัน `pnpm build` ขณะที่ `pnpm dev` ทำงานอยู่ ทำให้แคช `.next` เสียหาย**
  หน้าเว็บขึ้น 500 พร้อม `ENOENT ... _buildManifest.js.tmp` · แก้ด้วยการหยุด dev server
  ลบ `frontend/.next` แล้วเริ่มใหม่ · **อย่ารันสองอย่างพร้อมกัน**
- **`nest start` ทิ้ง process ลูกไว้เมื่อ parent ถูก kill** ต้องหา PID ที่ฟังพอร์ต 4000 แล้วปิดเอง
  ไม่งั้นครั้งถัดไปจะได้ `EADDRINUSE` และ (แย่กว่า) จะเป็น build เก่าที่ยังรันอยู่
- **`prisma migrate reset` ถูก Prisma บล็อกเมื่อ AI สั่ง** เหมือน `demo:reset` ที่บันทึกไว้ในเฟส 8
  ต้องให้ผู้ใช้รันเอง หรือให้ข้อความยินยอมมาใส่ `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`

### งานเก็บกวาดกลุ่ม 4

- **`hasPassed` เปลี่ยนความหมาย ป้ายบนจอจึงต้องเปลี่ยนตาม** — และเจอบั๊กจริงระหว่างไล่:
  `QuizResultDto.passScore` ส่งเกณฑ์**ปัจจุบัน**ออกไปคู่กับ `passed` ที่มาจาก snapshot
  หน้าเฉลยจึงขึ้น "ผ่าน" คู่กับ "เกณฑ์ผ่าน 70%" ได้ทั้งที่คะแนน 65 · แก้เป็นส่งเกณฑ์ของ attempt นั้น
  และ `QuizAttemptSummaryDto` มี `passScore` รายแถว หน้าประวัติจะบอกเกณฑ์กำกับ**เฉพาะแถวที่ต่างจากปัจจุบัน**
  · ป้ายในตาราง A9 เปลี่ยนเป็น "เคยผ่าน"/"ยังไม่ผ่าน" และเพิ่มบรรทัดอธิบายเฉพาะเคสที่ตัวเลขดูขัดกัน
  · **`LessonSidebar` ไม่ต้องแก้** เพราะ "ผ่านแบบทดสอบแล้ว" เป็นอดีตกาลและหมายถึงภาพรวมอยู่แล้ว
- **B3 ตัวกรองผู้สอน**: `instructorId` ใน query + `search` ครอบ `instructor.displayName` ด้วย ·
  `GET /courses/instructors` (`@Public()`) คืนเฉพาะผู้สอนที่มีคอร์ส `PUBLISHED`
  ถ้าใส่คนที่มีแต่ฉบับร่างเข้าไป จะได้ตัวเลือกที่เลือกแล้วไม่เจออะไร **และเป็นการบอกคนนอกว่าคนนั้นมีฉบับร่างอยู่**
  · route ประกาศก่อน `:id` เหมือน `mine` · dropdown ซ่อนทั้งอันถ้ายังไม่มีใครเผยแพร่
- **D3 เป้าหมาย 24 ชม.**: `overdueTotal` มาจาก `COUNT(*) FILTER (WHERE ...)` **ใน statement เดียวกับ `pendingTotal`**
  ไม่ได้ยิง query เพิ่ม · FE คำนวณเวลาที่รอจาก ISO instant ด้วยนาฬิกาเบราว์เซอร์ ไม่มีการ hardcode timezone ที่ไหน
  · `formatElapsedSince()` / `hoursSince()` ใน `lib/format.ts`
- **D2**: เพิ่มลิงก์ "กระเป๋าเงิน" ใน sidebar ผู้สอน · **ไม่เพิ่มใน bottom nav** เพราะ `BottomNav` จงใจเป็นของผู้เรียนอย่างเดียว
  (มีเหตุผลเขียนไว้ในไฟล์: sidebar เป็นทางเดินของผู้สอนอยู่แล้ว สอง nav จะตอบคำถาม "ฉันอยู่ตรงไหน" คนละแบบ)
  และ sidebar ผู้สอนยุบเป็นแถบแนวนอนที่จอเล็กอยู่แล้ว ลิงก์จึงเข้าถึงได้บนมือถือผ่านทางของตัวเอง
- **ลบ `/cart` `/checkout` `/orders` ออกจาก `middleware.ts`** ไม่มีหน้าเหล่านี้อยู่จริงสักหน้า
- **CHECK constraint จับของจริงทันที**: `quizzes.service.spec.ts` มี fixture ที่ตั้ง `passScore: 50`
  ค้างจากขอบเขตเดิม ฐานข้อมูลปฏิเสธตอนรันเทสต์ชุดเต็ม — เปลี่ยนเป็น `QUIZ_PASS_SCORE_MIN` แล้ว

### CHECK constraint ที่ Prisma ไม่รู้จัก (migration `20260908093000_...`)

ฐานข้อมูลบังคับเพดานของ ทก.01 เองอีกชั้น นอกเหนือจาก DTO:

| constraint | ตาราง | กติกา |
|---|---|---|
| `Course_price_within_scope` | `Course` | `price >= 0 AND price <= 10000` (A4) |
| `Quiz_passScore_within_scope` | `Quiz` | `passScore >= 60 AND passScore <= 100` (A7) |

**`QuizAttempt.passScoreSnapshot` ไม่มี constraint โดยตั้งใจ** เพราะเป็น**ประวัติ ไม่ใช่นโยบาย**
ถ้าวันหนึ่งช่วงที่อนุญาตเปลี่ยน ค่าเดิมต้องเก็บไว้ได้เหมือนเดิม — ใส่ constraint ตรงนั้นจะแปลว่า
การแก้กติกาต้องไปเขียนอดีตใหม่ ซึ่งตรงข้ามกับเหตุผลที่ snapshot มีอยู่ (มีเทสต์ยืนยันว่าเก็บค่า 50 ได้)

**⚠️ กัน schema drift — สำคัญ** Prisma ไม่ได้ model CHECK constraint จึงมองไม่เห็นใน `schema.prisma`
- `prisma migrate dev` จะคิดว่าฐานข้อมูล **drift** และ**เสนอ reset ฐานข้อมูลทิ้ง** ถ้าเผลอกด yes ข้อมูล dev หายหมด
- ปฏิบัติ: สร้าง migration ใหม่ด้วย `prisma migrate dev --create-only` แล้วแก้ SQL เอง หรือใช้
  `prisma migrate deploy` เมื่อแค่ต้องการ apply
- **ห้ามลบโฟลเดอร์ migration ใบนี้** และห้าม `prisma db push` กับฐานข้อมูลที่มี constraint นี้อยู่
- ตรวจว่ายังอยู่ครบ: `\d+ "Course"` และ `\d+ "Quiz"` ใน psql · หรือรัน `test/scope-check-constraints.spec.ts`
  ซึ่งยิง raw SQL ค่าเกินเข้าไปตรงๆ แล้วต้องได้ SQLSTATE `23514` ทั้งสองตัว
- ก่อนสร้าง constraint ได้ query ข้อมูลจริงทั้ง `getownly` และ `getownly_test` แล้ว ไม่มีแถวละเมิดเลย
  (คอร์ส 8 ใบ 0–2,890 บาท · แบบทดสอบ 7 ชุด เกณฑ์ 70–75)

### ค่าคงที่ของขอบเขต (ทก.01) — `packages/shared/src/limits.ts`

**ตัวเลขทุกตัวที่เอกสาร ทก.01 กำหนดไว้ อยู่ในไฟล์นี้ไฟล์เดียว** ห้ามประกาศซ้ำที่อื่นเด็ดขาด
`COURSE_MAX_PRICE_BAHT` (10,000) · `UPLOAD_MAX_MB` (video **150**, material 50, cover/avatar/slip 5) ·
`COURSE_MAX_STORAGE_BYTES` (**1 GB**) · `QUIZ_PASS_SCORE_MIN`/`MAX` (**60**-100) · `TOPUP_REVIEW_TARGET_HOURS` (24)
พร้อม helper `mbToBytes()` และ `formatBytesThai()` ที่ทุกข้อความเรื่องโควตาต้องใช้ตัวเดียวกัน

- **backend เพิ่ม dependency `@getownly/shared` แล้ว** (เดิมมีแต่ frontend) — `packages/shared` จึงมี
  `"prepare": "tsc -p tsconfig.json"` เพื่อให้ `pnpm install` สร้าง `dist/` ให้เอง
  **ถ้า `pnpm dev:be`/`pnpm test` พังด้วย "Cannot find module '@getownly/shared'" ให้รัน `pnpm build:shared`**
  (`dist/` ยังอยู่ใน .gitignore ตามเดิม)
- **ลบ `UPLOAD_MAX_VIDEO_MB` / `UPLOAD_MAX_DOCUMENT_MB` / `UPLOAD_MAX_IMAGE_MB` ออกจาก env แล้ว**
  ทั้งใน `.env.example` และ `env.validation.ts` — เพดานพวกนี้เป็น**ข้อผูกพันของเอกสาร ไม่ใช่ค่าคอนฟิกของ deployment**
  ถ้าปล่อยไว้ใน env จะมีทางที่เครื่องหนึ่งบังคับ 150MB แต่อีกเครื่องบังคับ 500MB ซึ่งตอบกรรมการไม่ได้
  ค่าที่ค้างอยู่ใน `.env` เก่าถูกเพิกเฉยเงียบๆ ไม่ throw (`validateEnv` เก็บ key ส่วนเกินไว้อยู่แล้ว)
  `MaterialsService` จึงไม่รับ `ConfigService` อีกต่อไป (constructor เหลือ 3 ตัว)
- **`upload-rules.ts` ไม่มี `UploadLimitsMb` และ `LimitName` อีกแล้ว** `maxBytesFor(kind)`/`maxMbFor(kind)`
  รับพารามิเตอร์เดียว อ่านจาก `UPLOAD_MAX_MB` ตรงๆ — `UploadsService` `MaterialsService` `TopupsService`
  ใช้เส้นทางเดียวกันหมด
- **`backend/src/config/scope-limits.spec.ts` เป็นที่เดียวในระบบที่เขียนตัวเลขเหล่านี้ด้วยมือ**
  เทสต์อื่นทั้งหมด import ค่าจาก `limits.ts` ซึ่งดีตรงที่ไม่มีทางหลุด แต่แปลว่าถ้าพิมพ์ผิดใน `limits.ts`
  เทสต์ทุกข้อจะเลื่อนตามไปด้วยและยังผ่านอยู่ ไฟล์นี้จึงกางค่าจริงออกมาเทียบ เพื่อให้การแก้ตัวเลขต้องตั้งใจเสมอ
- **ข้อความโควตาบอกตัวเลขจริง** `CourseStorageLimitExceededException` รับ `(usedBytes, remainingBytes, fileSize)`
  แล้วขึ้นว่า "ใช้ไป 467 MB จาก 1 GB เหลือ 557 MB แต่ไฟล์นี้มีขนาด 600 MB" พร้อมส่ง 4 ค่าเดียวกันใน `details`
- **`prisma/seed.ts` บันทึก `Lesson.videoSize` และ `Course.storageUsedBytes` จริงแล้ว** (เดิมไม่เคยบันทึกเลย
  แถบโควตาบนหน้าแก้ไขคอร์สจึงขึ้น 0 ทั้งที่มีวิดีโอหลายบท) ขนาดคำนวณจาก `durationSec x 40,000 ไบต์/วินาที`
  แล้ว **throw ถ้าเกินเพดาน** ทั้งระดับคลิปและระดับคอร์ส — ข้อมูลสาธิตต้องเคารพกฎที่กำลังจะอธิบายให้กรรมการฟัง
  ผลจริงหลังแก้: คอร์สใหญ่สุด 467 MB · คลิปใหญ่สุด 82 MB
- **`Quiz.passScore` ใน seed เป็น 70 และ 75 ทั้ง 7 ชุด** ไม่มีชุดไหนต่ำกว่า 60 จึงไม่ต้องแก้

### สิ่งที่ตัดสินใจเพิ่มตอนทำขอบเขตอัปเดต 2.3.1–2.3.4 (ราคาคอร์ส พื้นที่จัดเก็บ เกณฑ์ผ่าน Soft Lock และการแจ้งเนื้อหา)

รอบนี้เริ่มจากตรวจสอบสถานะปัจจุบันก่อนลงมือ (`SCOPE_UPDATE_AUDIT.md` ที่ root ของ repo) แล้วค่อยแก้ตามที่ตรวจพบ
ไม่ใช่งานเฟสถัดไปตามผัง 8 เฟสเดิม แต่เป็นการอัปเดตขอบเขตที่ทับซ้อนกับเฟส 3 เฟส 6 และเฟส 7 ที่ทำไปแล้ว

- **ราคาคอร์สห้ามเกิน 10,000 บาท** — ก่อนหน้านี้ไม่มีเพดานเลย มีแค่ตรวจรูปแบบตัวเลข (regex ไม่เกิน 8 หลัก)
  เพิ่ม custom validator `MaxPriceBaht` ใน `course-request.dto.ts` เพราะราคายังเป็น string ทั้งเส้นทางตามกติกาเรื่องเงิน
  (แปลงเป็น `Number` แค่ชั่วขณะเพื่อเทียบค่าเท่านั้น ไม่เคยไหลลงไปคำนวณหรือบันทึก) และ zod schema ฝั่ง frontend ต้องคัดลอกเพดานตามเดิม
- **พื้นที่จัดเก็บต่อคอร์สห้ามเกิน 3GB (วิดีโอ+เอกสารรวมกัน)** — ก่อนหน้านี้ไม่มีอะไรเลยแม้แต่แบบ SUM สดๆ
  ที่น่าแปลกใจกว่านั้นคือ **ขนาดไฟล์วิดีโอไม่เคยถูกบันทึกไว้ที่ไหนเลย** (`Lesson.videoKey` มีแต่ไม่มี field ขนาดไฟล์คู่กัน)
  ต้องเพิ่ม `Lesson.videoSize Int?` ก่อน ถึงจะรวมยอดได้จริง
  **`Course.storageUsedBytes` เป็น `BigInt` ไม่ใช่ `Int`** เพราะเพดาน 3GB (3,221,225,472 ไบต์) เกิน `Int32` (`~2.1` พันล้าน)
  แปลงเป็น `Number` ตอนออก DTO เท่านั้น ปลอดภัยเพราะ 3GB ยังต่ำกว่า `Number.MAX_SAFE_INTEGER` มาก — กติกา "ห้ามเป็น number" ในหัวข้อ 5
  คุ้มครองเฉพาะเงิน ไม่ใช่ไบต์
  **`CourseAccessService.assertStorageAvailable()`/`adjustStorageUsage()`** เป็นที่เดียวที่ตัดสินและปรับยอดสะสม
  ตรวจสองจุดเสมอ (เหมือนกติกาไฟล์เดี่ยวที่มีอยู่แล้ว): ครั้งแรกที่ `POST /uploads/presign` เทียบกับขนาดที่ client อ้าง
  ครั้งที่สองที่ `MaterialsService.create()`/`LessonsService.create()`/`update()` เทียบกับขนาดจริงจาก `storage.stat()`
  **ไม่ได้ล็อกแถวแบบ `FOR UPDATE`** เหมือนบัญชีคู่ เพราะนี่ไม่ใช่เงิน ยอมรับ race window เล็กๆ ตามระดับความเสี่ยงที่ยอมรับได้ของโปรเจกต์เดี่ยวนี้
  **`POST /uploads/presign` ต้องมี `courseId` เมื่อ `kind` เป็น `video`/`material`** (ไม่ต้องมีสำหรับ `cover`/`avatar`/`slip`)
  ฝั่ง frontend `uploadFile()` ส่ง `lesson.courseId` ไปด้วยตอนอัปโหลดวิดีโอ/เอกสาร
- **เกณฑ์ผ่านแบบทดสอบ (`Quiz.passScore`) ต้องอยู่ 50–100** — เดิมมี validation อยู่แล้วแต่พื้นล่างเป็น 1 ไม่ใช่ 50
  แก้แค่ backend (`@Min(50)` ใน `CreateQuizDto`/`UpdateQuizDto`) เพราะ **หน้าจอให้ผู้สอนสร้าง/แก้ไขแบบทดสอบยังไม่มีอยู่จริง**
  (ยังเป็น empty state "coming soon" ตามที่บันทึกไว้ในเฟส 6) เพดานนี้ต้องใช้ทันทีเมื่อมีคนสร้างหน้าจอนั้นในอนาคต
- **Soft Lock ตรวจแล้วว่าเป็นจริงอยู่แล้วทั้งระบบ ไม่มีอะไรต้องแก้** ไม่เคยมี hard lock logic ทั้ง backend และ frontend
  (`LessonsService`/`LearnService` เช็คแค่ enrollment ไม่เช็คลำดับหรือคะแนนสอบ, sidebar ไม่มีไอคอนล็อก) — บันทึกไว้กันเผลอเพิ่มในอนาคต
- **ระบบแจ้งเนื้อหาไม่เหมาะสม (`ContentReport`) เป็นของใหม่ทั้งหมด** โมดูล `src/modules/content-reports/`
  - **route คือ `/content-reports` และ `/admin/content-reports` ไม่ใช่ `/reports`** เพราะ `/admin/reports` ถูกใช้แล้วโดย
    `AdminReportsController` (รายงานยอดขาย/งบทดลอง) คนละเรื่องกันโดยสิ้นเชิงแต่ชื่อชนกัน
  - **`POST /content-reports` ไม่มี `@Roles` เฉพาะ** ทุกบทบาทที่ login แล้วแจ้งได้ เหมือนแบบที่ endpoint ถาม-ตอบทำไว้
    ถ้าเป็นการแจ้งกระทู้ (`targetType: QNA_THREAD`) ต้องผ่าน `CourseAccessService.resolveQnaAccess()` ก่อนเสมอ
    เพื่อกันคนที่เข้าถึงกระทู้นั้นไม่ได้มาแจ้ง — ใช้ตัวตัดสินสิทธิ์ตัวเดียวกับที่กระดานถาม-ตอบใช้อยู่แล้ว ไม่สร้างกติกาใหม่ซ้อน
  - **`targetId` ไม่ใช่ foreign key** เพราะชี้ได้ทั้งไปที่ `Course` หรือ `QnaThread` แล้วแต่ `targetType`
    เลียนแบบรูปแบบ `LedgerTransaction.referenceType`/`referenceId` ที่มีอยู่แล้วในระบบ
  - **เพิ่ม `CourseStatus.SUSPENDED`** แยกจาก `UNPUBLISHED` ที่มีอยู่แล้ว เพราะความหมายและผู้กระทำต่างกัน:
    `UNPUBLISHED` คือผู้สอนถอดคอร์สเอง ส่วน `SUSPENDED` คือ ADMIN ระงับจากการถูกแจ้ง — ปนกันจะทำให้ตอบไม่ได้ว่าใครเป็นคนสั่ง
    **ไม่ต้องแก้โค้ดชั้นการมองเห็น/การเข้าเรียนเลย** เพราะของเดิมออกแบบไว้ดีอยู่แล้ว: `assertCourseVisible()` ปฏิเสธทุกสถานะ
    ที่ไม่ใช่ `PUBLISHED` เหมือนกันหมด (เจ้าของ/ADMIN ผ่าน คนอื่น 404) และ `assertEnrolled()` เช็คจากแถว `Enrollment` เท่านั้น
    ไม่เคยดู `Course.status` เลย — คนที่ซื้อไปแล้วจึงเข้าเรียนได้ปกติโดยอัตโนมัติทั้งสองกรณี (`UNPUBLISHED` และ `SUSPENDED`)
  - **`PATCH /admin/content-reports/:id/review` รับ `{ status, suspendCourse? }`** — `suspendCourse` มีผลก็ต่อเมื่อ
    `status: REVIEWED` และ `targetType: COURSE` เท่านั้น ค่าอื่นถูกเพิกเฉยเงียบๆ ไม่ throw เพราะ "ขอระงับพร้อมกับยกฟ้อง"
    ไม่ใช่คำขอที่มีอยู่จริง ไม่ใช่ error
  - **รายงานหนึ่งใบตัดสินได้ครั้งเดียว** (`ContentReportAlreadyReviewedException` 409) กัน ADMIN สองคนเปิดคิวพร้อมกันแล้วตัดสินซ้ำ
    เหมือนกติกาเดียวกับคิวอนุมัติคอร์ส
  - **`PATCH /admin/content-reports/:id/restore-course` คืนคอร์สจาก `SUSPENDED` กลับ `PUBLISHED`** (เพิ่มทีหลังจากรอบแรก
    ที่ยังไม่ได้ทำ) ตัดสินจาก**สถานะจริงของคอร์ส**ไม่ใช่สถานะของ report — `CourseNotSuspendedException` (409) ครอบทั้งสองกรณี
    ที่ไม่ควรทำได้: report นี้ไม่ได้แจ้งคอร์ส (`targetType: QNA_THREAD`) หรือคอร์สนั้นไม่ได้ถูกระงับอยู่แล้ว (คืนไปแล้วครั้งหนึ่ง
    หรือไม่เคยถูกระงับเลย) เพราะสองกรณีนี้ผลลัพธ์เดียวกัน: ไม่มีอะไรให้คืน · ตั้ง report ที่เกี่ยวข้องเป็น `DISMISSED` พร้อม
    `reviewedById`/`reviewedAt` ถ้ายังไม่ใช่ (ไม่ทับถ้า dismiss ไปแล้ว) ไม่แตะ `publishedAt` เพราะเป็นการคืนสถานะ ไม่ใช่เผยแพร่ครั้งแรก
  - **`ContentReportDto.courseStatus`** เพิ่มเข้ามาพร้อม endpoint นี้ — สถานะปัจจุบันของคอร์ส เมื่อ `targetType: COURSE`
    เท่านั้น (เป็น `null` สำหรับ `QNA_THREAD`) เพราะ `targetId` ไม่ใช่ FK ต่อ join ตรงๆ ไม่ได้ `listForAdmin()` จึง batch
    query คอร์สทั้งหมดในหน้านั้นครั้งเดียวแล้ว map เข้า ไม่ query ทีละแถว · หน้าคิว ADMIN โชว์ป้าย "ถูกระงับชั่วคราว" และปุ่ม
    "คืนสถานะเผยแพร่" เฉพาะแถวที่ `courseStatus === SUSPENDED` โดยไม่สนสถานะของ report เอง (แถวที่ถูกระงับไปแล้วเป็น
    `REVIEWED` เสมอ แต่ปุ่มดูจากคอร์สไม่ใช่จาก report status)
  - Frontend: ปุ่ม "แจ้งเนื้อหาไม่เหมาะสม" (`ReportContentButton.tsx`) ใช้ `<dialog>` เหมือน modal ตรวจสลิปในเฟส 4-5
    วางไว้ที่หน้าคอร์ส (ซ่อนถ้าเป็นเจ้าของคอร์สเองหรือยังไม่ login) และหน้ากระทู้ถาม-ตอบ · หน้าคิว ADMIN ใหม่ที่ `/admin/content-reports`
- **ตรวจสอบหัวข้อรีเซ็ตรหัสผ่านผ่านอีเมลตามที่ผู้ใช้ขอ พบว่ามีอยู่แล้วครบสมบูรณ์** ไม่ใช่ของใหม่ ไม่ต้องสร้างอะไรเพิ่ม
  `PasswordResetToken` มีใน schema ตั้งแต่เฟส 2, `POST /auth/forgot-password`/`POST /auth/reset-password` ทำงานครบ
  (ตอบข้อความเดียวกันไม่ว่าอีเมลมีจริงไหม, เก็บ token แบบ hash, ใช้ครั้งเดียว atomic ผ่าน `updateMany` ที่เดียวกับที่กันกดซ้ำ,
  revoke refresh token ทั้งหมดหลังรีเซ็ต) และมีเทสต์ e2e ครอบทุก edge case ที่ขอ (`backend/test/auth.e2e.spec.ts`
  describe "password reset") อยู่แล้วตั้งแต่ก่อนรอบนี้ — บันทึกไว้กันเผลอสร้างซ้ำในอนาคต
- **migration ของรอบนี้มี 2 ใบ**: `20260901154812_add_course_storage_tracking` (Course.storageUsedBytes, Lesson.videoSize)
  และ `20260901160706_add_content_reports` (enum `ContentReportTargetType`/`ContentReportStatus`, ค่า `SUSPENDED`
  เพิ่มเข้า `CourseStatus`, ตาราง `ContentReport`)
- **เทสต์ของรอบนี้**: DTO ราคาคอร์ส (3) · DTO เกณฑ์ผ่าน (4) · การอัปโหลดกับเพดานพื้นที่จัดเก็บ (`uploads.service.spec.ts` เพิ่ม 4,
  `lessons.service.spec.ts` เพิ่ม 5, `materials.service.spec.ts` ใหม่ทั้งไฟล์ 4 — โมดูล materials ไม่เคยมีเทสต์ของตัวเองมาก่อนเลย)
  · `content-reports.service.spec.ts` ใหม่ 14 + DTO 5 (ภายหลังเพิ่ม `restoreCourse` อีก 5 ข้อ) · รวมทั้งชุด **325 ข้อ** ผ่านหมด

### สิ่งที่ตัดสินใจเพิ่มตอนทำหลังบ้าน ADMIN รายงาน และงานเก็บกวาด (เฟส 8)

- **migration เดียวของเฟสนี้คือ `passwordChangedAt` บน `User`** (`20260812110601_add_password_changed_at`)
  ไม่ได้อยู่ในสเปก แต่จำเป็นเพราะเจอบั๊กจริงตอนยิงทดสอบ — ดูหัวข้อถัดไป
  ส่วนฟีเจอร์ที่สเปกขอมาใช้คอลัมน์ที่มีอยู่แล้วทั้งหมด (`User.status` `User.commissionRate` `Category` `Course.status`)
- **บั๊กที่เจอและแก้: เปลี่ยนรหัสผ่านแล้ว session เดิมยังใช้ได้ต่ออีก 15 นาที**
  ของเดิม revoke แค่ refresh token ส่วน access token ที่ยังไม่หมดอายุยังผ่าน guard ได้อยู่
  **บั๊กเดียวกันนี้มีมาตั้งแต่เฟส 2 ในเส้นทางตั้งรหัสผ่านใหม่ด้วย** และแก้พร้อมกันแล้ว
  วิธีแก้: stamp `passwordChangedAt` แล้วให้ `JwtAuthGuard` ปฏิเสธ token ที่ออกก่อนหน้านั้น
- **access token มี claim `mintedAt` เป็นมิลลิวินาที ไม่ได้ใช้ `iat` มาตรฐาน**
  เพราะ `iat` ละเอียดแค่ระดับวินาที ซึ่งแยกไม่ออกระหว่าง token ที่ออก *ก่อน* กับ *หลัง* การเปลี่ยนรหัสผ่านในวินาทีเดียวกัน
  และทั้งสองกรณีเกิดจริง (คนเปลี่ยนรหัสผ่านเสร็จก็ล็อกอินใหม่ทันที) · **เทสต์ e2e จับกรณีนี้ได้จริง**
  token เก่าที่ไม่มี `mintedAt` ยังผ่านได้ เพื่อไม่ให้ทุก session หลุดตอน deploy และมันหมดอายุเองใน 15 นาทีอยู่แล้ว
- **รายงานทุกตัวอ่านจาก `LedgerEntry` ไม่ใช่ `Enrollment`** ตามที่สเปกกำหนด
  ใช้ `$queryRaw` เพราะต้อง `JOIN` ข้ามจาก ledger ไป `Enrollment` ผ่าน `referenceId` ซึ่งไม่ใช่ FK จริงใน schema
  **แยกฝั่งของรายการด้วย `direction` + `account.kind`**: `DEBIT`+`USER_WALLET` = เงินที่ผู้เรียนจ่าย ·
  `CREDIT`+`PLATFORM_REVENUE` = ส่วนแบ่งแพลตฟอร์ม · `CREDIT`+`USER_WALLET` = รายได้ผู้สอน
  มีเทสต์พิสูจน์ว่า **ผลรวมรายได้ผู้สอนทุกคน = ยอดค้างจ่ายที่ ADMIN เห็น** และ **กราฟรายวันรวมแล้ว = ยอดในการ์ด**
- **รายงานอ่านตามเวลาไทยเสมอ** (`report-range.ts`, `Asia/Bangkok`)
  timestamp เก็บเป็น UTC การขายตอนตี 1 ที่กรุงเทพจึงเป็น 18:00 ของเมื่อวานใน UTC
  ถ้าไม่แปลงก่อน group ยอดขายจะไปอยู่แท่งผิดวัน · SQL ใช้ `(createdAt AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok'`
  ต้องติดป้าย UTC ก่อน ไม่งั้น Postgres จะใช้ timezone ของเครื่อง แล้วฐานข้อมูลเดียวกันจะรายงานคนละวันบนคนละเครื่อง
- **`changePercent` คืน `null` เมื่อช่วงก่อนหน้าเป็นศูนย์** ไม่ใช่ 100% และไม่ใช่ infinity
  "เพิ่มขึ้นจากศูนย์" ไม่มีเปอร์เซ็นต์ · หน้าจอขึ้นว่า "ไม่มีข้อมูลช่วงก่อนหน้าให้เทียบ"
- **"ยอดค้างจ่ายผู้สอน" = รายได้สะสมทั้งหมด เพราะยังไม่มีการถอนเงิน** เขียนกำกับไว้ทั้งใน DTO และบนหน้าจอ
  เมื่อทำเฟส 7 ส่วนที่เหลือต้องหักยอดที่ถอนแล้วออกจากตัวเลขนี้
- **`recharts` เป็น dependency ใหญ่ตัวเดียวที่เพิ่มในเฟสนี้** ผู้ใช้ระบุมาเองในสเปก (ข้อห้าม 12 จึงไม่ติด)
  **`frontend/src/lib/chart-theme.ts` เป็นที่ที่สองและที่สุดท้ายที่ hardcode สีได้** (ที่แรกคืออีเมล HTML ในเฟส 2)
  เพราะ recharts วาดลง SVG ด้วยค่าสีเป็นสตริง ไม่ใช่ CSS class · ค่าต้องตรงกับ token ในหัวข้อ 4 เป๊ะ
- **หน้า `/profile` อยู่ใน route group ใหม่ `(account)`** เพราะใช้ร่วมกันทั้งสามบทบาท
  header ของ `(student)` จะยื่นเมนู "คอร์สของฉัน" ให้ ADMIN และ sidebar ของอีกสองกลุ่มก็พาไปผิดที่
- **`PATCH /users/me` รับได้แค่ 3 ฟิลด์** (displayName, bio, expertise) · role status email username ไม่มีอยู่ใน DTO
  จึงไม่มีทางที่ payload แปลกปลอมจะไปถึงมันได้ (ValidationPipe ตั้ง `forbidNonWhitelisted` ไว้อยู่แล้ว)
- **ตั้งอัตราส่วนแบ่งได้เฉพาะบัญชี INSTRUCTOR และไม่เกิน 0.50** (`COMMISSION_NOT_APPLICABLE` 422)
  หน้าจอให้กรอกเป็นจำนวนเต็มเปอร์เซ็นต์แล้วแปลงเป็น `(n/100).toFixed(4)` **ที่เดียว** ก่อนส่ง
  เพื่อให้ 12% เป็น `"0.1200"` ไม่ใช่ `0.12000000000000001`
- **ADMIN ระงับบัญชีตัวเองไม่ได้** (`CANNOT_SUSPEND_SELF` 409) ไม่ใช่เรื่องมารยาท แต่เพราะ `JwtAuthGuard`
  อ่านผู้ใช้จาก DB ทุก request คำขอถัดไปจะถูกปฏิเสธทันที และหลังบ้านจะถูกล็อกไว้ข้างนอก
- **อนุมัติ/ปฏิเสธคอร์สได้เฉพาะสถานะ `PENDING_REVIEW`** (`COURSE_NOT_UNDER_REVIEW` 409)
  กันสองแท็บที่เปิดคิวค้างไว้กดทับกัน · การอนุมัติจะล้าง `rejectReason` เดิมทิ้ง เพราะคำติที่แก้แล้วไม่ควรค้างให้ผู้สอนเห็น
- **`CourseReviewService` แยกจาก `CoursesService`** เพราะสองตัวรับใช้คนละคน
  ตัวหนึ่งรับใช้ผู้สอนที่แก้งานตัวเอง อีกตัวรับใช้ ADMIN ที่ตัดสินว่าแพลตฟอร์มจะรับของชิ้นนี้ไหม
  รวมไว้คลาสเดียวจะได้ไฟล์ที่คำถาม "แตะคอร์สนี้ได้ไหม" มีคำตอบสองแบบ
- **slug ของหมวดหมู่ที่ไม่ได้กรอกเองจะได้ `category-<random>`** ไม่พยายามถอดเสียงภาษาไทยเป็นอังกฤษ
  เพราะเดาผิดแล้วจะถูกฝังลง URL สาธารณะ · ADMIN ตั้ง slug จริงเองได้ทีหลัง
- **ลบหมวดหมู่ไม่ได้ถ้ายังมีคอร์สอยู่ นับรวมฉบับร่างด้วย** (`CATEGORY_IN_USE` 409)
  FK เป็น `onDelete: Restrict` อยู่แล้ว โค้ดแค่แปลง error ของฐานข้อมูลเป็นประโยคที่ ADMIN ทำอะไรต่อได้
- **`prisma/demo-seed.ts` เขียน ledger ด้วยกติกาเดียวกับ `LedgerService` แต่ไม่ได้ import มา**
  เพราะสคริปต์รันนอก Nest ไม่มี injector · **และตรวจ `SUM(debit) = SUM(credit)` ก่อนจบเสมอ ถ้าไม่ตรงจะ throw**
  ข้อมูลสาธิตจึงเชื่อถือได้เท่ากับข้อมูลที่เกิดจากการกดใช้งานจริง
- **`pnpm demo:reset` ถูก Prisma บล็อกเมื่อ AI เป็นคนสั่ง** ต้องมี `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`
  ที่มีข้อความยินยอมของผู้ใช้จริง · ถ้า session ถัดไปต้องรันคำสั่งนี้ ให้ถามผู้ใช้ก่อนทุกครั้ง
- **เทสต์ของเฟสนี้: `reports` (18) · `users` (15) · `course-review` (9) · `categories` (8) และ e2e เพิ่ม 1 ข้อ**
  รวมทั้งชุด **252 ข้อ** · เทสต์ของ `reports` มีจุดเดียวในระบบที่ `UPDATE` แถว ledger
  (เลื่อน `createdAt` ย้อนหลังเพื่อสร้างประวัติโดยไม่ต้องรอเป็นเดือน) มีคอมเมนต์กำกับว่าทำไมไม่ขัดข้อห้าม 5
- **ข้อจำกัดที่รู้แล้ว: ยังไม่ได้ตรวจ responsive บนจอ 375px ด้วยตา และยังไม่ได้ลองติดตั้งจาก README บนเครื่องเปล่า**
  ตารางทุกใบใส่ `overflow-x-auto` ไว้แล้ว แต่ยังไม่มีใครเปิดดูจริง

### สิ่งที่ตัดสินใจเพิ่มตอนทำระบบถาม-ตอบ (เฟส 7 บางส่วน)

- **ไม่มี migration ในเฟสนี้เลย** — `QnaThread` และ `QnaReply` มีใน schema ตั้งแต่เฟส 1 แล้ว
  ส่วนรีวิว การถอนเงิน และการแจ้งเตือนของเฟส 7 ยังไม่มี model จึงต้อง migrate เมื่อลงมือทำ
- **`QnaReply` ไม่มีคอลัมน์ `isInstructorReply` และจะไม่เพิ่ม** — คำนวณจาก `reply.userId === course.instructorId`
  ตอนแมป DTO · ธงที่เก็บไว้คือสำเนาที่สองของข้อเท็จจริงที่ join รู้อยู่แล้ว และสำเนาย่อมเพี้ยนตามกันไม่ทัน
  (ต่างจาก snapshot ราคาในหัวข้อ 5 ซึ่งต้องเก็บ เพราะราคา *ตั้งใจ* ให้เปลี่ยนได้ แต่เจ้าของคอร์สไม่เปลี่ยนมือ)
- **`CourseAccessService.resolveQnaAccess()` เป็นที่เดียวที่ตอบว่าใครทำอะไรได้บนกระดาน**
  คืน `{ isInstructor, isAdmin, isEnrolled, canAsk, canReply }` แล้ว throw ทันทีถ้าอ่านไม่ได้ · ทุก method ใน `QnaService` เริ่มจากตรงนี้
  **สามบทบาทไม่ได้ซ้อนกัน**: ผู้เรียนที่ซื้อแล้ว ถามได้+ตอบได้ · ผู้สอนเจ้าของ ตอบได้แต่ถามไม่ได้ · ADMIN อ่านและลบได้แต่ร่วมสนทนาไม่ได้
- **ผู้สอนตั้งคำถามในคอร์สตัวเองไม่ได้** (`QNA_ASK_REQUIRES_ENROLLMENT` 403) คำถามจากคนที่เป็นผู้ตอบเองจะไม่มีใครตอบ
- **ADMIN ตอบไม่ได้** (`QNA_REPLY_NOT_ALLOWED` 403) ต่างจากที่อื่นในระบบที่ ADMIN ผ่านทุกด่าน
  ตามสเปกของรอบนี้ที่ระบุผู้มีสิทธิ์ตอบไว้สองกลุ่ม · ADMIN มีสิทธิ์ลบไว้ใช้กำกับดูแลอยู่แล้ว
  **และปิดกระทู้ก็ไม่ได้เช่นกัน** (`NOT_QNA_THREAD_OWNER`) เพราะการปิดคือคำพูดของผู้ถามหรือผู้สอน ไม่ใช่การกำกับดูแล
- **"รอคำตอบ" = ผู้สอนยังไม่ตอบ ไม่ใช่ยังไม่มีใครตอบ** ทั้งใน `filter=unanswered` `unansweredTotal` และกล่องคำถามของผู้สอน
  ใช้ `replies: { none: { userId: instructorId } }` · คำเดาของเพื่อนร่วมคอร์สไม่ใช่คำตอบที่ป้ายสีเขียวสัญญาไว้ (มีเทสต์ครอบ)
- **กล่องคำถามของผู้สอนตัด `isResolved: true` ออก** ถ้าผู้ถามปิดเองแล้ว ก็ไม่มีใครรออยู่ · เรียง **เก่าก่อน** เพราะคิวไม่ใช่ฟีดข่าว
- **ทุก mutation (ตอบ/ปิด/เปิดใหม่) คืนกระทู้ทั้งใบ ไม่ใช่แถวที่เพิ่งสร้าง** หน้าจอจึงไม่ต้องเดาว่าป้ายสถานะเปลี่ยนเป็นอะไร
  และไม่ต้องยิงซ้ำเพื่อ refresh · แบบเดียวกับที่ `POST /quizzes/:id/submit` คืนกระดาษที่ตรวจแล้วทั้งใบในเฟส 6
- **ปิดกระทู้แล้วยังตอบเพิ่มได้** ไม่มีกติกาห้ามไว้ และกระทู้ที่ปิดแล้วตอบต่อไม่ได้จะกลายเป็นทางตันเมื่อมีคำถามค้าง
  `PATCH /qna/:threadId/resolve` รับ `{ isResolved }` ที่ไม่ใส่ = ปิด จึงใช้เปิดใหม่ได้ด้วย endpoint เดียวกัน
- **`lessonId` เป็น optional และตรวจว่าอยู่ในคอร์สเดียวกัน** (`LESSON_NOT_IN_COURSE`)
  แท็บถาม-ตอบในหน้าบทเรียนลิงก์มาที่ `/learn/[courseId]/qna?lesson=<id>` ฟอร์มจึงเลือกบทให้ล่วงหน้า
  **แท็บนั้นเดิมเป็น empty state ที่เขียนว่า "จะเปิดใช้ในเฟสถัดไป" ซึ่งตอนนี้ไม่จริงแล้ว จึงเปลี่ยนเป็นลิงก์เข้ากระดาน**
- **`canAsk` + `canReply` เดินทางมาใน response ของกระดาน** ไม่ใช่ให้หน้าเว็บเดาจาก role
  สองค่าคู่กันแยกสามบทบาทออกจากกันได้พอดี จึงขึ้นคำอธิบายที่ถูกต้องให้แต่ละคนโดยไม่ต้องรู้ว่าใครเป็นใคร
- **ตัวกรองและหน้าของกระดานอยู่ใน React state ไม่ใช่ใน URL** ตรงข้ามกับ `/courses` ในเฟส 3
  เพราะลิงก์ผลค้นหาของกระดานที่ต้องลงทะเบียนก่อนถึงเปิดได้ ไม่มีประโยชน์กับคนที่ได้รับลิงก์
- **ลิงก์ "กลับ" ของกระดานชี้ที่ `/courses/[id]` เมื่อผู้ดูไม่ได้ลงทะเบียน** เพราะห้องเรียนมีอยู่เฉพาะคนที่ซื้อแล้ว
  ผู้สอนที่เดินมาจากกล่องคำถามจะไม่เจอทางตัน
- **เทสต์ของเฟสนี้: `qna.service.spec.ts` (21 ข้อ)** รวมทั้งชุด 202 ข้อ · มีข้อที่ตรวจว่าไม่มีอีเมลของใครหลุดใน payload
- **ข้อจำกัดที่รู้แล้ว: ยังไม่มีการแจ้งเตือน** ผู้สอนต้องเปิด `/instructor/qna` เอง ระบบไม่ส่งอีเมลหรือแจ้งในเว็บ
  เป็นส่วนที่เหลือของเฟส 7 พร้อมกับรีวิวและการถอนเงิน

### สิ่งที่ตัดสินใจเพิ่มตอนทำห้องเรียน ความคืบหน้า และแบบทดสอบ (เฟส 6)

- **ไม่มี migration ในเฟสนี้เลย** — `LessonProgress` `Quiz` `QuizQuestion` `QuizChoice` `QuizAttempt` `QuizAttemptAnswer`
  มีอยู่ใน schema ตั้งแต่เฟส 1 แล้วและใช้ได้ตามที่ออกแบบไว้ · `prisma/seed.ts` ก็สร้างแบบทดสอบตัวอย่างไว้ 7 ชุดแล้ว
- **`GET /learn/:courseId/lessons/:lessonId` คืน `videoStreamUrl` เป็น path ของ API เอง (`/lessons/:id/stream`) ไม่ใช่ presigned URL**
  สเปกของเฟสนี้เขียนว่า "signed URL วิดีโอ" แต่ข้อห้าม 10 ห้ามไว้ชัด และเฟส 3 บังคับไว้แล้วด้วย `VIDEO_REQUIRES_STREAM_ENDPOINT`
  **เอกสารแนบยังใช้ presigned GET ตามเดิม** เพราะไฟล์ที่ตั้งใจให้ดาวน์โหลดกับวิดีโอที่ห้ามแชร์ต่อคือคนละเรื่องกัน
  มีเทสต์ที่ตรวจว่าไม่มีสตริง `video/` หลุดออกไปใน payload ไหนเลย
- **path เป็น relative ไม่ใช่ absolute** เว็บรู้ base ของ API อยู่แล้ว (`apiUrl()` ใน `lib/api-client.ts`)
  การใส่ host มาจาก backend จะพังทันทีที่ API ย้ายเครื่อง
- **ห้องเรียนเข้าได้เฉพาะคนที่มีแถว `Enrollment` เท่านั้น — ผู้สอนเจ้าของคอร์สและ ADMIN ก็เข้าไม่ได้**
  ต่างจาก `canReadLessonContent` ของเฟส 3 ที่ปล่อยเจ้าของผ่าน เพราะทุกอย่างในห้องเรียนผูกกับ `enrollmentId`
  ถ้าให้เจ้าของเข้า จะไม่มีที่เก็บ progress ให้ · ผู้สอนตรวจเนื้อหาตัวเองผ่านหน้าแก้ไขหลักสูตรแทน
  ตรรกะอยู่ที่ `CourseAccessService.assertEnrolled()` ที่เดียว (`NOT_ENROLLED` 403) ใช้ร่วมกันทั้ง `learn/` และ `quizzes/`
- **`PATCH /progress/:lessonId` ไม่แตะ `completedAt` เด็ดขาด** ดูค้างไว้ไม่ใช่เรียนจบ และการกรอกลับไม่ทำให้บทที่จบแล้วกลับมาไม่จบ
  **`POST /progress/:lessonId/complete` เป็น idempotent** กดซ้ำแล้ว `completedAt` เดิมยังอยู่ ไม่ถูกเขียนทับ
- **กติกา "ดูครบ 90% ถือว่าเรียนจบ" อยู่ฝั่งเว็บที่เดียว** (`COMPLETION_RATIO` ใน `lib/learn/types.ts`)
  backend รับแค่คำสั่ง "จบแล้ว" ตรงๆ · เอาไว้สองที่จะเพี้ยนกันแน่นอน และ backend ไม่รู้ว่าผู้ใช้ดูจริงหรือลากแถบข้าม
- **บันทึกตำแหน่งทุก 10 วินาที + ตอนกด pause + ตอนออกจากหน้า** และข้ามการยิงถ้าขยับไม่ถึง 1 วินาที
  ถ้ายิงไม่สำเร็จจะ **ไม่** เลื่อนหมุดที่จำไว้ รอบถัดไปจึงลองใหม่เอง และไม่มี error โผล่ขวางคนที่กำลังดูวิดีโอ
- **`<video>` ใช้ `crossOrigin="use-credentials"`** เพราะเบราว์เซอร์เป็นคนโหลดเอง คุกกี้จึงต้องถูกสั่งให้ไปด้วย
  และเพราะ **การ retry ที่ฝังใน `apiRequest` มองไม่เห็น 401 ของ `<video>`** จึง export `refreshSession()` ออกมา
  ให้ `onError` หมุน session หนึ่งครั้งแล้ว `video.load()` ใหม่ · ครั้งที่สองถือว่าจบ แสดงข้อความแทน
- **แบบทดสอบทำซ้ำได้ไม่จำกัด เก็บทุกครั้ง ตัดสินด้วยคะแนนสูงสุด** จึงไม่มี `maxAttempts` และไม่มีการจับเวลา
  (PLAN.md หัวข้อ 1.3 เขียนไว้ว่ามี — schema จริงไม่มีมาตั้งแต่เฟส 1 และรอบนี้ยืนยันว่าไม่ทำ)
- **หนึ่งบทเรียนมีแบบทดสอบได้ไม่เกินหนึ่งชุด** (`Quiz.lessonId` เป็น unique) และ **ทุกข้อต้องมีตัวเลือกถูกหนึ่งตัวพอดี**
  (`QUIZ_QUESTION_INVALID` 422) — ไม่มีข้อจะตรวจไม่ได้ มีสองข้อคะแนนจะขึ้นกับว่าจิ้มอันไหน ซึ่งไม่ใช่ข้อสอบ
- **แบบทดสอบที่มีคนทำไปแล้ว แก้ไม่ได้และลบไม่ได้** (`QUIZ_HAS_ATTEMPTS` 409) เหตุผลเดียวกับ R17 เรื่องลบบทเรียนที่มีคนเรียนแล้ว
  และเป็นสิ่งที่ FK `onDelete: Restrict` ของ `QuizAttemptAnswer` บังคับอยู่แล้วในระดับฐานข้อมูล — โค้ดแค่บอกเหตุผลเป็นภาษาไทย
  **`PATCH /quizzes/:id` จึงเขียนทับข้อสอบทั้งชุดเสมอ** ไม่มี endpoint แก้รายข้อ เพราะไม่จำเป็น
- **`QuizTakeDto` ไม่มีฟิลด์ `isCorrect` ให้ใส่ตั้งแต่ระดับ type** ไม่ใช่ "อย่าลืมลบออก" แต่เป็นรูปทรงที่ใส่ไม่ได้
  ส่วน `QuizResultDto` มีเฉลยครบ เพราะตรวจเสร็จแล้วและหน้าเฉลยคือเหตุผลที่มันมีอยู่
- **ตรวจคำตอบต้องเป็นหนึ่งคำตอบต่อหนึ่งข้อพอดี** ขาด เกิน ซ้ำ หรือหยิบตัวเลือกข้ามข้อ = `QUIZ_ANSWER_MISMATCH` 422
  ไม่ใช่ "ตอบผิด" เพราะมันคือคำขอที่ผิดรูป ไม่ใช่คำตอบที่ผิด · คะแนน = `round(ถูก/ทั้งหมด × 100)` ทุกข้อน้ำหนักเท่ากัน
- **`GET /quizzes/:id/attempts/mine` ส่ง `latestResult` (เฉลยเต็มของครั้งล่าสุด) มาด้วย** หน้า `/result` จึงยิงครั้งเดียวจบ
  และเปิดหน้าเดิมซ้ำอีกสัปดาห์ถัดมาก็ยังเห็นผลเดิม ไม่ต้องพึ่งค่าที่ค้างอยู่ในหน่วยความจำของเบราว์เซอร์
  เรียงด้วย `attemptedAt desc` แล้วตัดสินเสมอด้วย `id desc` ด้วยเหตุผลเดียวกับ `GET /wallet`
- **หน้าเฟสนี้เป็น client component ทั้งหมด ไม่ใช่ SSR** ต่างจาก `/courses` ที่เป็น Server Component
  เพราะ `serverFetch` หมุน refresh token ไม่ได้ (ไม่มีที่วางคุกกี้ใหม่) access token อายุ 15 นาทีจึงทำให้ห้องเรียนกลายเป็นหน้า error ได้ง่าย
  ทางเดียวกับที่ `/my-courses` ทำไว้แล้ว
- **`/learn/[courseId]` ไม่ใช่หน้า แต่เป็นทางผ่าน** อ่าน `resumeLessonId` แล้ว `router.replace` ไปบทที่ยังไม่จบบทแรก
  ใช้ `replace` ไม่ใช่ `push` เพื่อไม่ให้ทางผ่านไปขวางปุ่มย้อนกลับ
- **`/learn/[courseId]/quiz/[quizId]` กับ `/learn/[courseId]/[lessonId]` อยู่ระดับเดียวกันได้** เพราะ Next จับ segment ที่เป็นข้อความตรงๆ ก่อน dynamic เสมอ
- **แท็บ "ถาม-ตอบ" มีอยู่แต่เป็น empty state ภาษาไทยที่บอกว่าจะเปิดใช้ในเฟส 7** ตามข้อห้าม 14 (ห้ามข้ามไปทำเฟสถัดไป)
  หน้าบทเรียนออกแบบมาเป็นสามแท็บ การซ่อนไปเลยจะทำให้เลย์เอาต์เพี้ยนกว่าการบอกความจริง
- **แท็บของหน้าบทเรียนใช้ `<button role="tab">` ไม่ใช่ Radix** แบบเดียวกับแท็บของหน้าแก้ไขคอร์สในเฟส 3 (ข้อห้าม 12)
- **เทสต์ของเฟสนี้: `learn.service.spec.ts` (19 ข้อ) และ `quizzes.service.spec.ts` (20 ข้อ)** รวมทั้งชุด 181 ข้อ
  ใช้ PostgreSQL จริง + `FakeStorage` · เพิ่ม `createQuiz()` ใน `test/factories.ts` ที่ตัวเลือกแรกถูกเสมอ
  เพื่อให้เทสต์สั่ง "ตอบถูกหมด" หรือ "ตอบผิดหมด" ได้โดยไม่ต้องอ่านเฉลยกลับมาก่อน
- **ข้อจำกัดที่รู้แล้ว: ยังไม่มีหน้าจอให้ผู้สอนสร้างข้อสอบ** API ครบแล้วแต่แท็บ "แบบทดสอบ" ในหน้าแก้ไขคอร์สยังเป็น empty state
  แบบทดสอบที่เห็นบนเว็บตอนนี้มาจาก `prisma/seed.ts` ทั้งหมด

### สิ่งที่ตัดสินใจเพิ่มตอนทำ QR PromptPay สลิป และวงจรซื้อคอร์ส (เฟส 4–5)

- **`PROMPTPAY_ID` ใน `.env.example` เป็น `0000000000` โดยตั้งใจ** พร้อมคำเตือนในไฟล์
  เลขพร้อมเพย์จริงในไฟล์ที่ commit/ถ่ายจอ/ส่งพร้อมปริญญานิพนธ์ = ขอให้คนแปลกหน้าโอนเงินเข้าบัญชีนั้น
  `DEMO_MODE=true` (ค่าเริ่มต้น) ทำให้ทุกหน้าจอที่โชว์ QR ขึ้นข้อความ "QR สำหรับสาธิตระบบ กรุณาอย่าโอนเงินจริง"
  **ธงนี้เดินทางมาจาก API ในฟิลด์ `isDemoMode` ของ quote** ไม่ใช่ env ฝั่งเว็บ จะได้ไม่มีทางตั้งค่าคนละอย่างกัน
- **`POST /topups/quote` ไม่เขียนอะไรลงฐานข้อมูลเลย** quote ไม่ใช่คำขอ · ผู้ใช้กดสร้าง QR กี่ครั้งก็ได้
  `expiresAt` เป็นค่าบอกผู้ใช้เฉยๆ (`TOPUP_QUOTE_EXPIRY_MINUTES`) ไม่ได้จองอะไรไว้ · QR ที่หมดอายุบนจอยังโอนเข้าได้ปกติ
  จึงไม่ต้องเพิ่มคอลัมน์ `qrPayload`/`expiresAt` ใน `TopupRequest` ตามที่ PLAN.md หัวข้อ 1.5 เขียนไว้
- **`promptpay-qr` รับจำนวนเงินเป็น `number` — เป็นจุดเดียวในระบบที่เงินกลายเป็น number**
  อยู่ใน `PromptPayService.buildPayload()` ที่เดียว มีคอมเมนต์กำกับไว้ ปลอดภัยเพราะค่านั้นไปจบที่พิกเซลใน QR
  ไม่เคยถูกบันทึก คิด หรือ post ลง ledger · เพดาน `TOPUP_MAX_AMOUNT` อยู่ในช่วงที่ double เก็บทศนิยม 2 ตำแหน่งได้แม่นยำ
- **`POST /topups` เชื่อขนาดสลิปจาก `statObject` ของ MinIO ไม่ใช่จาก body** เหตุผลเดียวกับเอกสารแนบในเฟส 3
  และตรวจว่า key ขึ้นต้นด้วย `slip/` และ `ownerId` ใน key ตรงกับผู้เรียกจริง
- **`TopupsController` เป็น `@Roles(STUDENT, INSTRUCTOR)` — ADMIN เติมเงินไม่ได้** เพราะ ADMIN คือคนอนุมัติ
  และมี `CannotReviewOwnTopupException` ซ้อนอีกชั้นที่เทียบ `studentId` กับผู้ตรวจ เผื่อบทบาทถูกเปลี่ยนภายหลัง
- **จำกัดคำขอที่ยังไม่ตรวจไว้ 5 รายการต่อคน** (`TOPUP_TOO_MANY_PENDING`)
  คิวตรวจสลิปคือคนนั่งดูรูป คิวที่ไม่มีเพดานจึงเป็น DoS ใส่ ADMIN ไม่ใช่ใส่เซิร์ฟเวอร์
- **โครง module: `topups/` ถือ QR สลิป และคิวตรวจ · `enrollments/` ถือการซื้อและ "คอร์สของฉัน" · `ledger/` ถือเงิน**
  ทั้งสอง module เรียก `WalletService` เป็นทางเดียวที่เขียน ledger · `LedgerModule` เปิดเฉพาะฝั่งอ่าน (`GET /wallet`)
- **`EnrollmentsController` ใช้ `@Controller()` เปล่าแล้วเขียน path เต็ม** (`courses/:id/purchase` และ `enrollments/mine`)
  เพราะสองเส้นทางนี้อ่านรู้เรื่องคนละ root กัน การบังคับให้มี prefix ร่วมจะได้ URL ที่แย่ลง
- **`StorageService.presignGetOrNull()`** รวมแบบแผน "เซ็น URL ไม่ได้ก็คืน null ไม่ใช่พังทั้งหน้า" ไว้ที่เดียว
  `CoursesService.signCover` เดิมทำเองแล้ว ตอนนี้เรียกตัวนี้แทน · ปก อวตาร และสลิป ใช้ร่วมกันหมด
- **`GET /wallet` แบ่งหน้า และ `orderBy` มี `id` เป็นตัวตัดสินรอง** เพราะสองรายการที่เกิดใน ms เดียวกัน
  จะสลับที่กันระหว่างหน้าโดยไม่มีตัวตัดสินที่นิ่ง ทำให้รายการหนึ่งโผล่สองหน้าและอีกรายการหาย
  **ยอดคงเหลืออ่านจากแถว Account ไม่ใช่ผลรวมของหน้าที่ส่งกลับ**
- **`frontend/src/lib/money.ts` เทียบเงินด้วยจำนวนเต็มสตางค์** (`toSatang` แยกสตริงเอง ไม่ผ่าน `Number()` กับทศนิยม)
  ใช้ตัดสินว่าจะโชว์ปุ่ม "ซื้อคอร์สนี้" หรือ "เติมเงินเพื่อซื้อ" และคำนวณว่าขาดอีกเท่าไร
  **เป็นการตัดสินใจเรื่องหน้าจอเท่านั้น ราคาจริงและยอดจริงตัดสินที่ backend ที่ล็อกกระเป๋าแล้วอ่านราคาใหม่เสมอ**
- **ยอดกระเป๋าของหน้า `/courses/[id]` ดึงที่ฝั่ง server แล้วส่งเป็น prop** ปุ่มจึงถูกต้องตั้งแต่ paint แรก
  guest ได้ 401 ซึ่ง `serverFetch` แปลงเป็น `data: null` → ปุ่มกลายเป็น "เข้าสู่ระบบเพื่อซื้อ"
- **"ข้อความสีส้ม" ตอนเงินไม่พอใช้ token `pending`** เพราะจานสีในหัวข้อ 4 ไม่มีสีส้ม และยอดไม่พอคือคำเตือน ไม่ใช่ error
- **modal ตรวจสลิปใช้ `<dialog>` ของเบราว์เซอร์ ไม่ใช่ Radix** ได้ focus trap, ปุ่ม Escape และ backdrop ฟรี (ข้อห้าม 12)
  ต้องเรียก `showModal()` ใน `useEffect` — การ render `<dialog open>` เฉยๆ ไม่ทำให้เป็น modal
- **QR และรูปสลิปใช้ `<img>` ไม่ใช่ `next/image`** QR เป็น data URI และสลิปเป็นรูปขนาดไม่รู้ล่วงหน้าหลัง signed URL ที่หมดอายุ
  ทั้งสองกรณี `next/image` ไม่ได้อะไรเพิ่มและต้องประกาศขนาดตายตัว · มี `eslint-disable` กำกับเหตุผลไว้ในไฟล์
- **route group ใหม่ 2 กลุ่ม: `(student)` (header + ยอดเงิน + ออกจากระบบ) และ `(admin)` (sidebar สี primary)**
  เพิ่มหน้า `/admin` ขึ้นมาด้วย เพราะ `HOME_PATH_BY_ROLE.ADMIN` ชี้มาที่นี่ตั้งแต่เฟส 2 แต่ยังไม่มีหน้า
- **ข้อจำกัดที่รู้แล้ว: ADMIN เปิด `/my-courses` ได้ (middleware อนุญาตทุกคนที่ล็อกอิน) แล้วเจอ 403 จาก API**
  หน้าจะแสดง error state ภาษาไทยตามปกติ ไม่ขาว แต่ถ้าจะกันตั้งแต่ routing ต้องเพิ่มแนวคิด "ทุกบทบาทยกเว้น X" ใน `middleware.ts`
- **เทสต์ของเฟสนี้: `topups.service.spec.ts` (23 ข้อ) และ `enrollments.service.spec.ts` (4 ข้อ)** ใช้ PostgreSQL จริง + `FakeStorage`
  รวมทั้งชุด 142 ข้อ · `assertLedgerInvariants` ถูกเรียกท้ายเทสต์ที่แตะเงินทุกข้อ

### สิ่งที่ตัดสินใจเพิ่มตอนทำแคตตาล็อกและการสร้างคอร์ส (เฟส 3)

- **เปลี่ยนชื่อคอลัมน์ `Course.coverUrl` → `coverKey`** (migration `20260811163000_rename_course_cover_key`)
  คอลัมน์นี้เก็บ object key ของ MinIO มาตลอด ไม่ใช่ URL — และเก็บ URL ไม่ได้เพราะ presigned URL หมดอายุ
  API สร้าง `coverUrl` ที่เซ็นแล้วให้ใหม่ทุกครั้งที่อ่าน (ผ่าน `signCover()` ถ้า MinIO ล่มจะได้ `null` ไม่ใช่หน้าพัง)
- **`StorageService` (`src/infra/storage/`) เป็นที่เดียวที่คุยกับ MinIO** ใช้ไลบรารี `minio` มีทางออกจาก bucket 2 ทางที่ตั้งใจให้ต่างกัน
  `presignGet/presignPut` สำหรับปก อวตาร เอกสารแนบ และสลิป · `openRange` สำหรับวิดีโอบทเรียนที่ต้อง proxy เท่านั้น
- **object key คือ `<kind>/<userId>/<uuid>.<ext>`** โดย `kind` อยู่หน้าสุดเพื่อให้ตัดสินสิทธิ์จากตัว key ได้ก่อนแตะฐานข้อมูล
  **นามสกุลไฟล์มาจาก `mimeType` ที่ผ่านการตรวจแล้ว ไม่เคยเอามาจาก `fileName` ของ client**
- **`GET /uploads/signed-url/:key` ปฏิเสธ key ที่ขึ้นต้นด้วย `video/` เสมอ** (`VIDEO_REQUIRES_STREAM_ENDPOINT`)
  แม้แต่ ADMIN และแม้แต่คนที่อัปโหลดเอง ตามข้อห้าม 10 — วิดีโอออกทาง `GET /lessons/:id/stream` ทางเดียว
- **อายุ presigned URL: อ่าน 1 ชั่วโมง (`MINIO_PRESIGN_EXPIRY_SECONDS=3600`) · อัปโหลด 15 นาที**
  **ต่างจากหัวข้อ 5 ที่เขียนไว้ว่าเอกสารแนบและสลิปใช้ 5 นาที** — ใช้ตามสเปกเฟสนี้ที่ระบุ 1 ชั่วโมง
  ถ้าจะกลับไปใช้ 5 นาที แก้ค่าเดียวใน `.env` ได้ทันที ไม่ต้องแก้โค้ด
- **ขนาดเอกสารแนบเพิ่มเป็น 50MB** (`UPLOAD_MAX_DOCUMENT_MB=50`) ตามสเปกเฟสนี้ ต่างจากหัวข้อ 5 ที่เขียนไว้ 20MB
- **`POST /lessons/:id/materials` เชื่อขนาดไฟล์จาก `statObject` ของ MinIO ไม่ใช่จาก body**
  เพราะ client ขอ presign เป็น PDF 1KB แล้ววาง 2GB ลง URL เดิมได้ ตอน presign ตรวจได้แค่ค่าที่ *อ้าง*
- **`CourseAccessService` (`src/modules/courses/`) เป็นที่เดียวที่ตอบเรื่องความเป็นเจ้าของและการลงทะเบียน**
  `lessons` `materials` `uploads` เรียกใช้ร่วมกัน จึงไม่มี endpoint ไหนลืมตรวจชั้นที่สองได้
- **คอร์สที่ไม่ใช่ `PUBLISHED` ตอบ 404 ไม่ใช่ 403** สำหรับคนที่ไม่ใช่เจ้าของ ถ้าตอบ 403 การไล่เดา id จะกลายเป็นรายชื่อคอร์สฉบับร่าง
- **แก้คอร์สได้ทุกสถานะยกเว้น `PENDING_REVIEW`** (`COURSE_NOT_EDITABLE` 409)
  **ยังไม่ได้ทำกติกา "แก้ราคาคอร์สที่เผยแพร่แล้วต้องส่งอนุมัติใหม่"** ตามที่ PLAN.md หัวข้อ 1.2 เขียนไว้ ต้องทำพร้อมคิวอนุมัติของ ADMIN
- **จัดลำดับบทเรียนเขียน 2 รอบใน transaction เดียว** (พัก `orderIndex` ไว้ที่ค่าติดลบก่อน)
  เพราะ `@@unique([courseId, orderIndex])` จะชนกันทันทีถ้าย้ายทีละแถว · payload ต้องเป็น permutation ครบทุกบท ไม่รับ subset
- **`POST /courses/:id/lessons` ล็อกแถว Course ด้วย `FOR UPDATE` ก่อนหา `orderIndex` ถัดไป** กันสองแท็บสร้างบทเรียนพร้อมกันแล้วชน unique
- **ลบบทเรียนที่มี `LessonProgress` แล้วไม่ได้** (PLAN.md R17) · ลบคอร์สได้เฉพาะ `DRAFT` ที่ยังไม่มีคนลงทะเบียน
  ไฟล์ใน MinIO ถูกลบ **หลัง** ลบแถวในฐานข้อมูลสำเร็จ และเป็นแบบ best-effort เสมอ — MinIO ล่มต้องไม่ทำให้ผู้ใช้เห็นคอร์สที่บอกว่าลบแล้ว
- **`AllExceptionsFilter` ส่ง `details` ออกไปด้วยแล้ว** ของเดิมประกาศไว้ใน `BusinessException` แต่ filter ตัดทิ้ง
  ทำให้ `COURSE_INCOMPLETE` บอกไม่ได้ว่าขาดอะไรบ้าง ตอนนี้หน้าแก้ไขคอร์สแสดงรายการที่ยังขาดได้จริง
- **`JwtAuthGuard` แนบผู้ใช้ให้ route ที่เป็น `@Public()` ด้วย ถ้ามีคุกกี้ที่ใช้ได้** (best-effort ไม่ throw)
  ใช้คู่กับ `@OptionalUser()` เพื่อให้หน้าคอร์สสาธารณะรู้ว่าคนดูเป็นเจ้าของ (เห็นฉบับร่าง) หรือซื้อไปแล้ว (ปุ่ม "เข้าเรียน")
  **ใช้ได้เฉพาะเรื่องการแสดงผล ห้ามใช้ตัดสินสิทธิ์** อะไรที่ต้องล็อกอินต้องอยู่บน route ที่ไม่ `@Public()`
- **หน้า `/courses` เป็น Server Component และเก็บ state ของตัวกรองไว้ใน URL ทั้งหมด**
  ผลคือกดปุ่มย้อนกลับได้ แชร์ลิงก์ผลค้นหาได้ และ grid อยู่ใน HTML ชุดแรก มีแค่ฟอร์มตัวกรองที่เป็น client component
- **ข้อจำกัดที่รู้แล้ว: `/courses/[id]` ของคอร์สที่ไม่มีอยู่ตอบ HTTP 200 พร้อมหน้า "ไม่พบคอร์ส" ไม่ใช่ 404**
  Next flush shell ทันทีที่ render suspend รอ I/O จริง ซึ่งก็คือ fetch ตัวนั้นเอง พอถึง `notFound()` สถานะออกไปแล้ว
  ลองย้ายไปเรียกใน `generateMetadata` แล้วไม่ช่วย · จะได้ 404 จริงต้องไปเช็คใน middleware ซึ่งแลกด้วยการยิง API เพิ่มทุก request
- **อัปโหลดใช้ `XMLHttpRequest` ไม่ใช่ `fetch`** เพราะ fetch ยังรายงาน upload progress ไม่ได้ และวิดีโอ 500MB ที่ไม่มีแถบความคืบหน้าดูเหมือนเว็บค้าง
- **แท็บและ dropdown ไม่ใช้ Radix** ใช้ปุ่มกับ `<select>` ของเบราว์เซอร์ตรงๆ ได้ keyboard/screen reader ถูกต้องฟรีและไม่เพิ่ม dependency (ข้อห้าม 12)
- **`packages/shared/src/catalog.ts` มีสัญญาไว้ครบ แต่ frontend ยังประกาศ type ของตัวเองใน `lib/catalog/types.ts`**
  ทำตามแบบเดียวกับที่ `lib/auth/types.ts` ทำไว้ในเฟส 2 · ถ้าจะเลิกซ้ำต้องแก้ทั้งสองที่พร้อมกันทีเดียว
- **เทสต์ของเฟสนี้ใช้ `FakeStorage` (`test/fake-storage.ts`) แทน MinIO จริง**
  ต่างจากชั้น ledger ที่ต้องใช้ PostgreSQL จริงเพราะกติกาเรื่องเงินขึ้นกับ transaction และ lock จริง
  ส่วน object storage สิ่งที่ต้องพิสูจน์คือ "ขอ key ไหน" และ "ลบ key ไหน" ซึ่ง Map ตอบได้เร็วกว่าและไม่ต้องล้าง bucket

### สิ่งที่ตัดสินใจเพิ่มตอนทำระบบยืนยันตัวตน

- **แฮชรหัสผ่านเป็น bcrypt cost 12** (`BCRYPT_COST` ใน `.env`) ถอด `argon2` ของเฟส 1 ออกแล้ว
  `prisma/seed.ts` ใช้ค่าเดียวกัน ถ้าแก้ `BCRYPT_COST` ต้อง seed ใหม่ ไม่งั้นบัญชีตัวอย่างเข้าระบบไม่ได้
- **รูปแบบ error กลางคือ `{ statusCode, code, message, errors?, timestamp, path }`**
  `code` เป็นอังกฤษ UPPER_SNAKE ไว้ให้ frontend ตัดสิน flow · `message` เป็นไทยแสดงต่อผู้ใช้ได้ทันที ·
  `errors` เป็น map ราย field มาจาก class-validator (ชื่อ `errors` ไม่ใช่ `details` ตามที่กำหนดในเฟสนี้)
- **ชื่อคุกกี้:** `getownly_access_token` (path `/`) และ `getownly_refresh_token` (path `/api/auth`)
  ทั้งคู่ httpOnly + sameSite=lax และ **ไม่ตั้ง attribute `domain`** โดยตั้งใจ เพื่อผูกคุกกี้กับ host ที่ตั้งมันเท่านั้น
- **refresh token เป็น JWT ที่เก็บ SHA-256 ของตัวมันเองใน DB** ไม่ใช่ bcrypt เพราะ token สุ่ม 32 ไบต์
  ไม่มีเอนโทรปีต่ำให้ต้องถ่วงเวลา และต้องค้นหาจาก unique index ได้ตรงๆ
- **ตรวจจับการใช้ refresh token ซ้ำ** ถ้าเจอ token ที่ถูก revoke แล้วถูกยิงมาอีก จะ revoke ทุก session ของผู้ใช้นั้น
  **การ revoke นี้ต้องอยู่นอก `$transaction`** เพราะ `throw` หลังจากนั้นจะ rollback มันทิ้ง (เจอบั๊กนี้จากเทสต์จริง)
- **JwtAuthGuard อ่านผู้ใช้จาก DB ทุก request** ไม่เชื่อ role ใน token อย่างเดียว
  แลกกับ query เล็กๆ หนึ่งครั้ง เพื่อให้การระงับบัญชีมีผลทันที ไม่ต้องรอ access token หมดอายุ 15 นาที
- **`@Public()` เป็น opt-in** JwtAuthGuard ลงทะเบียนเป็น APP_GUARD ทุก route จึงต้อง login เป็นค่าเริ่มต้น ลืมแล้ว fail closed
- **Rate limit ใช้ named throttler + `skipIf`** เพราะ throttler ที่ตั้งชื่อไว้จะมีผลกับทุก route โดยปริยาย
  bucket `login` และ `forgotPassword` จึงข้ามตัวเองเว้นแต่ route ประกาศ `@RateLimit(...)`
- **`middleware.ts` ของ Next ใช้ `decodeJwt` ไม่ verify ลายเซ็น** เพราะไม่ต้องการก๊อป JWT secret ไปไว้ฝั่งเว็บ
  มันทำหน้าที่ routing/UX เท่านั้น **อำนาจตัดสินสิทธิ์จริงอยู่ที่ NestJS ทุก request**
- **ห้ามใช้ `useSearchParams` ในฟอร์มหลักของหน้า** เพราะทำให้ทั้งหน้ากลายเป็น client-only และ SSR ออกมาว่าง
  (หน้า `/login` อ่าน `?next=` ตอน submit แทน · `/reset-password` จำเป็นต้องใช้ จึงมี skeleton เป็น fallback)
- **อีเมล HTML hardcode ค่าสีได้ที่เดียวในระบบ** เพราะ email client ตัด `<style>` และไม่รู้จัก CSS variable
  ค่าที่ใช้ต้องตรงกับ token ในหัวข้อ 4 เป๊ะ

### สิ่งที่ตัดสินใจเพิ่มตอนทำแกนบัญชีคู่

- **โฟลเดอร์:** โค้ดอยู่ที่ `src/modules/ledger/` ไม่ใช่ `src/ledger/` เพื่อให้ตรงกับหัวข้อ 3 และ 5 ของไฟล์นี้
- **แยกเป็น 2 service ในโฟลเดอร์เดียว**
  `ledger.service.ts` = เครื่องยนต์บัญชีคู่ล้วนๆ (รู้จักแค่ Account / LedgerTransaction / LedgerEntry)
  `wallet.service.ts` = ตรรกะธุรกิจที่ผู้ใช้กดได้ (อนุมัติ/ปฏิเสธเติมเงิน · ซื้อคอร์ส) เรียก `ledger.postTransaction()` เป็นทางเดียวที่เขียน ledger
- **ทิศทางยอด (credit-normal):** `balance = Σ CREDIT − Σ DEBIT`
  กระเป๋าผู้ใช้และ `PLATFORM_REVENUE` เป็นบวก · `EXTERNAL_BANK` เป็นลบเสมอ
  ผลรวม balance ของทุกบัญชีในระบบจึงเท่ากับ 0 เสมอ ใช้เป็นค่าคงที่ตรวจความถูกต้อง
- **เพิ่มคอลัมน์ `LedgerTransaction.idempotencyKey` (unique)** ตามกติกาหัวข้อ 5 ของไฟล์นี้ที่ schema เฟส 1 ยังไม่มี
  ค่าเป็น `topup:<topupRequestId>` และ `purchase:<enrollmentId>` (migration `20260811152953_add_ledger_idempotency_key`)
- **การล็อก:** `lockAccounts()` ทำ `SELECT ... FOR UPDATE` เรียงตาม `id` เสมอ กัน deadlock เมื่อสองรายการแตะบัญชีชุดที่ทับกัน
  `postTransaction()` ล็อกซ้ำเองด้วย เพื่อกันไม่ให้มีเส้นทางไหนขยับ balance โดยไม่ถือล็อก
- **อัปเดต balance ด้วย SQL** `balance = balance + CAST($1 AS numeric)` ให้ Postgres บวกในชนิด numeric
  ยอดสรุปจึงตรงกับ entry ที่เพิ่งเขียนเป๊ะ ไม่มีทางเพี้ยนจากการอ่าน-คำนวณ-เขียนกลับ
- **คอร์สฟรี** สร้าง `Enrollment` แต่ **ไม่สร้าง LedgerTransaction** เพราะไม่มีเงินเคลื่อนไหว
- **ส่วนแบ่งที่ปัดแล้วเป็น 0** (เช่นคอร์ส 0.01 บาท) จะไม่เขียน entry จำนวนเงิน 0 ออกมา รายการนั้นจึงมี 2 แถวแทน 3
- **`INSUFFICIENT_WALLET_BALANCE` คืน 422** ไม่ใช่ 400 ตามที่ PLAN.md เฟส 5 เขียนไว้
  เพราะ request ถูกต้องตามรูปแบบทุกอย่าง แต่ผิดกติกาธุรกิจ ซึ่งตรงกับ `UnprocessableEntityException` ในหัวข้อ 5
- **ซื้อคอร์สซ้ำพร้อมกัน** ตัดสินด้วย unique index `(courseId, studentId)` และแปลง Prisma `P2002` เป็น `AlreadyEnrolledException`
  การเช็คด้วย `findUnique` ก่อนหน้าเป็นเพียงทางลัด ไม่ใช่ตัวกันจริง
- **เทสต์รันกับ PostgreSQL จริงใน Docker ไม่มี mock** ใช้ฐานข้อมูล `getownly_test` แยกต่างหากบน container เดียวกัน
  `test/global-setup.ts` สร้างและ migrate ให้เอง · `resetDatabase()` TRUNCATE ก่อนทุกเทสต์
  `test/invariants.ts` คือค่าคงที่ 3 ข้อที่ต้องจริงเสมอ เรียกท้ายเทสต์ส่วนใหญ่

### สิ่งที่ตัดสินใจเพิ่มระหว่างเฟส 1
- โครงสร้างฐานข้อมูลจริงใช้ตามที่กำหนดในเฟส 1 ซึ่งกระชับกว่ารายการ entity ใน PLAN.md
  (ยังไม่มี Order/OrderItem แยก · `Enrollment` เก็บ snapshot ราคาและอัตราส่วนแบ่งเอง ·
  `Quiz` ผูกกับ Lesson ไม่ใช่ Course · ยังไม่มี Review, Certificate, PayoutRequest,
  Notification, PlatformSetting, AuditLog) ให้เพิ่มทีละส่วนตามเฟสที่ต้องใช้จริง
- อัตราส่วนแบ่งเก็บเป็น `User.commissionRate` (`Decimal(5,4)`) ไม่มีตาราง InstructorProfile แยก
- ผังบัญชีของจริงคือ `USER_WALLET` / `PLATFORM_REVENUE` / `EXTERNAL_BANK`
  รายได้ผู้สอนเข้า `USER_WALLET` ของผู้สอนเอง ไม่มีบัญชี `INSTRUCTOR_PAYABLE` แยก
  เมื่อทำการถอนเงินในเฟส 7 ต้องเพิ่มค่า `PAYOUT` ใน enum `TxType`
- `Account` มี `@@unique([ownerId, kind])` แต่ Postgres มอง NULL ว่าไม่ซ้ำกัน
  จึงไม่ได้กันบัญชี `PLATFORM_REVENUE`/`EXTERNAL_BANK` ซ้ำในระดับฐานข้อมูล
  ต้องกันในโค้ดหรือเพิ่ม partial unique index เมื่อเริ่มเขียน LedgerService

- ก่อนลงมือทุกครั้ง: เปิด [PLAN.md](PLAN.md) ดูว่าตอนนี้อยู่เฟสไหน และเกณฑ์ตรวจรับของเฟสนั้นคืออะไร
- ถ้าเจอทางแยกที่กระทบโครงสร้างข้อมูลหรือขอบเขตงาน **ให้ถามก่อน อย่าเดา**
- เมื่อจบแต่ละเฟส ให้อัปเดตสถานะเฟสใน PLAN.md และบันทึกสิ่งที่ตัดสินใจเพิ่มเติมลงไฟล์นี้
