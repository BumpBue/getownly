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
├─ .env.example            ตัวแปรทั้งหมดที่ระบบต้องใช้ (ห้าม commit .env จริง)
├─ CLAUDE.md
├─ PLAN.md
├─ README.md
│
├─ backend/                NestJS
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
cp .env.example .env
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
