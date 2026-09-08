# getownly

แพลตฟอร์มตลาดกลางขายคอร์สเรียนออนไลน์ (ปริญญานิพนธ์)

ผู้สอนหลายคนเปิดคอร์สขาย ผู้เรียนค้นหาและซื้อ แพลตฟอร์มหักส่วนแบ่งรายได้
ชำระเงินแบบไทย: ระบบสร้าง QR PromptPay ระบุจำนวนเงิน ผู้เรียนโอนแล้วแนบสลิป
ผู้ดูแลระบบตรวจสอบและอนุมัติ เงินเข้ากระเป๋าในระบบ แล้วซื้อคอร์สโดยตัดจากกระเป๋า
**ทุกการเคลื่อนไหวของเงินบันทึกด้วยระบบบัญชีคู่ (double-entry) และรายงานทุกหน้าคำนวณจากบัญชีนั้นโดยตรง**

> **สถานะ: เฟส 1–8 ทำครบตามขอบเขตที่ตกลงไว้**
> วงจรใช้งานเดินได้ครบรอบ: สมัคร → เติมเงินด้วย QR PromptPay → ผู้ดูแลอนุมัติสลิป →
> ซื้อคอร์ส → เข้าห้องเรียน → ทำแบบทดสอบ → ถามผู้สอน · ฝั่งหลังบ้านมีคิวตรวจสลิป
> คิวอนุมัติคอร์ส จัดการผู้ใช้ จัดการหมวดหมู่ และรายงานที่อ่านจากบัญชีคู่
> **ส่วนที่ยังไม่ได้ทำ:** ตะกร้าสินค้า · ใบประกาศนียบัตร · รีวิวและให้ดาว · การถอนเงินของผู้สอน ·
> ระบบแจ้งเตือน · หน้าจอสร้างข้อสอบของผู้สอน — รายละเอียดอยู่ที่หัวข้อ
> [ข้อจำกัดที่ทราบ](#ข้อจำกัดที่ทราบ) และ [PLAN.md](PLAN.md)
>
> กติกาการพัฒนาทั้งหมดอยู่ใน [CLAUDE.md](CLAUDE.md)

---

## สารบัญ

- [สิ่งที่ต้องมีก่อน](#สิ่งที่ต้องมีก่อน)
- [ติดตั้งครั้งแรก](#ติดตั้งครั้งแรก)
- [บัญชีทดสอบ](#บัญชีทดสอบ)
- [ข้อมูลสำหรับวันสาธิต](#ข้อมูลสำหรับวันสาธิต)
- [URL ตอนพัฒนา](#url-ตอนพัฒนา)
- [คำสั่งที่ใช้บ่อย](#คำสั่งที่ใช้บ่อย)
- [สถาปัตยกรรม](#สถาปัตยกรรม)
- [แผนผังข้อมูล](#แผนผังข้อมูล)
- [ระบบบัญชีคู่](#ระบบบัญชีคู่)
- [แผนผังหน้าจอ](#แผนผังหน้าจอ)
- [การทดสอบ](#การทดสอบ)
- [แก้ปัญหาที่พบบ่อย](#แก้ปัญหาที่พบบ่อย)
- [ข้อจำกัดที่ทราบ](#ข้อจำกัดที่ทราบ)

---

## สิ่งที่ต้องมีก่อน

| เครื่องมือ | เวอร์ชันขั้นต่ำ | ตรวจสอบด้วย |
|---|---|---|
| Node.js | 20.11 | `node --version` |
| pnpm | 10 | `pnpm --version` |
| Docker Desktop | 24 | `docker --version` |

---

## ติดตั้งครั้งแรก

```bash
# 1. ติดตั้ง dependency ของทั้ง workspace
pnpm install

# 2. เตรียมไฟล์ตัวแปรสภาพแวดล้อม
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# 3. ยกฐานข้อมูล MinIO และ Mailhog ขึ้นมา
pnpm docker:up

# 4. สร้างตารางในฐานข้อมูล
pnpm db:migrate

# 5. ใส่ข้อมูลตัวอย่าง
pnpm db:seed

# 6. เริ่มใช้งาน
pnpm dev
```

บน Windows PowerShell ให้ใช้ `Copy-Item backend\.env.example backend\.env` แทนคำสั่ง `cp`

เปิด <http://localhost:3000> แล้วเข้าสู่ระบบด้วยบัญชีในหัวข้อถัดไปได้ทันที

---

## บัญชีทดสอบ

รหัสผ่านทั้งหมดตั้งไว้ใน `backend/.env` และใช้เฉพาะเครื่องพัฒนาเท่านั้น

| บทบาท | อีเมล | รหัสผ่าน | เข้าไปทำอะไรได้ |
|---|---|---|---|
| **ADMIN** | `admin@getownly.local` | `Admin@1234` | ตรวจสลิปเติมเงิน · อนุมัติคอร์ส · จัดการผู้ใช้และหมวดหมู่ · ดูรายงานทั้งระบบ |
| **INSTRUCTOR** (ส่วนแบ่ง 30%) | `thanakrit@getownly.local` | `Password@1234` | สร้างคอร์ส · อัปโหลดวิดีโอ · ตอบคำถาม · ดูรายงานยอดขายของตัวเอง |
| **INSTRUCTOR** (ส่วนแบ่ง 25%) | `piyada@getownly.local` | `Password@1234` | เหมือนข้างบน |
| **INSTRUCTOR** (ส่วนแบ่ง 20%) | `natthaphong@getownly.local` | `Password@1234` | เหมือนข้างบน |
| **STUDENT** | `teerapat@getownly.local` | `Password@1234` | เติมเงิน · ซื้อคอร์ส · เข้าห้องเรียน · ทำแบบทดสอบ · ถามผู้สอน |
| **STUDENT** (อีก 4 บัญชี) | `kamonchanok@` `siriporn@` `anon@` `paweena@` `getownly.local` | `Password@1234` | เหมือนข้างบน |

ข้อมูลที่ `pnpm db:seed` สร้างให้: หมวดหมู่ 4 หมวด · คอร์ส 8 คอร์ส (เนื้อหาเรื่อง Autodesk Maya
เป็นหลัก มีคอร์สฟรี 1 คอร์ส คอร์ส `DRAFT` 1 คอร์ส และ `PENDING_REVIEW` 1 คอร์สไว้ทดสอบคิวอนุมัติ) ·
บทเรียน 51 บท · เอกสารแนบ 8 ไฟล์ · แบบทดสอบ 7 ชุด · บัญชีในระบบบัญชีคู่ 11 บัญชี

> ค่า `videoKey` และ `fileKey` ของข้อมูลตัวอย่างเป็นชื่อ object ที่ยังไม่มีไฟล์จริงใน MinIO
> หน้าจอทุกหน้าใช้งานได้ปกติ แต่กดเล่นวิดีโอจะไม่มีภาพจนกว่าจะอัปโหลดไฟล์จริงผ่านหน้าผู้สอน

---

## ข้อมูลสำหรับวันสาธิต

`pnpm db:seed` ให้แค่คอร์สกับผู้ใช้ ซึ่งทำให้หน้ารายงานว่างเปล่าเพราะยังไม่มีเงินไหลผ่านระบบ
สำหรับวันนำเสนอให้ใช้

```bash
pnpm demo:reset
```

คำสั่งนี้ **ลบข้อมูลทั้งหมด** แล้วสร้างใหม่จาก `seed.ts` + `demo-seed.ts` ซึ่งเพิ่มประวัติย้อนหลังให้ครบ

| สิ่งที่เพิ่มให้ | จำนวนโดยประมาณ |
|---|---|
| เติมเงินที่อนุมัติแล้ว | 5 รายการ |
| เติมเงินที่รอตรวจสอบ (ให้ ADMIN กดสาธิต) | 2 รายการ |
| การซื้อคอร์ส กระจายย้อนหลัง 5 เดือน | ~12 รายการ |
| ความคืบหน้าการเรียน | ~60 รายการ |
| ผลการทำแบบทดสอบ | ~6 รายการ |
| กระทู้ถาม-ตอบ (ตอบแล้วบางส่วน ค้างบางส่วน) | 5 กระทู้ |

ทุกการเคลื่อนไหวของเงินในสคริปต์นี้เดินผ่านกติกาบัญชีคู่ชุดเดียวกับที่ API ใช้ และ
**สคริปต์จะตรวจว่า `SUM(debit) = SUM(credit)` ก่อนจบเสมอ** ถ้าไม่ตรงจะ throw ทิ้งทันที
ข้อมูลสาธิตจึงเชื่อถือได้เท่ากับข้อมูลที่เกิดจากการกดใช้งานจริง

ถ้าอยากเพิ่มข้อมูลสาธิตทับของเดิมโดยไม่ล้างฐานข้อมูล ใช้ `pnpm db:demo` แทน

---

## URL ตอนพัฒนา

| บริการ | URL | หมายเหตุ |
|---|---|---|
| เว็บ (Next.js) | <http://localhost:3000> | |
| API (NestJS) | <http://localhost:4000/api> | |
| MinIO Console | <http://localhost:9101> | ผู้ใช้ `getownly` รหัส `getownly_dev_password` |
| Mailhog | <http://localhost:8025> | อีเมลทุกฉบับที่ระบบส่งจะมาโผล่ที่นี่ |
| Prisma Studio | <http://localhost:5555> | เปิดด้วย `pnpm db:studio` |
| PostgreSQL | `localhost:5433` | ฐานข้อมูล `getownly` ผู้ใช้ `getownly` |

> **ทำไม PostgreSQL ถึงใช้พอร์ต 5433** — เครื่องพัฒนาส่วนใหญ่มี PostgreSQL ติดตั้งไว้อยู่แล้ว
> และครองพอร์ต 5432 ทำให้ Prisma ต่อไปเจอฐานข้อมูลผิดตัวโดยไม่รู้ตัว (จะขึ้น
> `P1000: Authentication failed`) container จึงเปิดออกมาที่พอร์ต 5433 แทน
> ถ้าเครื่องคุณไม่มีอะไรใช้ 5432 จะเปลี่ยนกลับก็ได้ โดยแก้ `docker-compose.yml`
> เป็น `'5432:5432'` แล้วแก้ `DATABASE_URL` ใน `backend/.env` ให้ตรงกัน

---

## คำสั่งที่ใช้บ่อย

รันจาก root ของ workspace ทุกคำสั่ง

```bash
# พัฒนา
pnpm dev                  # backend + frontend พร้อมกัน
pnpm dev:be               # backend อย่างเดียว (:4000)
pnpm dev:fe               # frontend อย่างเดียว (:3000)

# Docker
pnpm docker:up            # ยกบริการเบื้องหลัง (postgres, minio, mailhog)
pnpm docker:down          # หยุด แต่เก็บข้อมูลไว้
pnpm docker:reset         # หยุด ลบ volume ทั้งหมด แล้วยกใหม่

docker compose --profile full up --build   # ยกทั้งระบบรวมแอปในคอนเทนเนอร์
docker compose --profile full down         # หยุดโหมดนี้

# ฐานข้อมูล
pnpm db:migrate           # สร้าง/ปรับ migration ตาม schema.prisma
pnpm db:migrate:name ชื่อ  # ตั้งชื่อ migration เอง
pnpm db:reset             # ล้างฐานข้อมูล แล้ว migrate + seed ใหม่
pnpm db:seed              # ใส่ข้อมูลตัวอย่าง (ล้างของเดิมก่อนเสมอ)
pnpm demo:reset           # ล้าง + seed + ข้อมูลสาธิตย้อนหลัง (ใช้ก่อนวันนำเสนอ)
pnpm db:demo              # เพิ่มข้อมูลสาธิตทับของเดิมโดยไม่ล้าง
pnpm db:studio            # เปิด Prisma Studio
pnpm db:generate          # สร้าง Prisma Client ใหม่

# คุณภาพโค้ด
pnpm typecheck            # ตรวจ type ทั้ง 3 แพ็กเกจ
pnpm lint
pnpm test                 # Vitest ฝั่ง backend (ต้องยก Docker ขึ้นก่อน)
pnpm test:responsive      # ตรวจ responsive 375/768/1440 (ต้องมี pnpm dev รันอยู่)
pnpm build
pnpm format               # Prettier ทั้ง repo
```

> **ห้ามรัน `pnpm build` ขณะที่ `pnpm dev` ทำงานอยู่** ทั้งสองเขียนลง `frontend/.next`
> ที่เดียวกัน แคชจะเสียหายและทุกหน้าจะขึ้น error 500
> แก้โดยหยุด dev server ลบโฟลเดอร์ `frontend/.next` แล้วเริ่มใหม่
>
> รายละเอียดการตรวจ responsive อยู่ที่ [`frontend/test/README.md`](frontend/test/README.md)

---

## รันทั้งระบบด้วย Docker (ทก.01 ข้อ 2.7.4)

มีสองโหมด เลือกตามงานที่ทำ

| โหมด | คำสั่ง | เหมาะกับ |
|---|---|---|
| **เบื้องหลังอย่างเดียว** (ค่าเริ่มต้น) | `pnpm docker:up` แล้ว `pnpm dev` | การพัฒนาประจำวัน — แก้โค้ดแล้วเห็นผลทันที ไม่ต้อง build ใหม่ |
| **ทั้งระบบในคอนเทนเนอร์** | `docker compose --profile full up --build` | ยกทั้งระบบบนเครื่องเปล่าด้วยคำสั่งเดียว เช่นวันสาธิตหรือวันสอบ |

โหมดที่สองยกครบทั้ง PostgreSQL, MinIO, Mailhog, API และเว็บ
**migration จะรันให้อัตโนมัติตอน API เริ่มทำงาน** จึงใช้กับฐานข้อมูลว่างเปล่าได้เลย

> **โหมด `full` ใช้ฐานข้อมูลของตัวเองชื่อ `getownly_docker` ไม่ใช่ `getownly`**
> เพราะมันรัน migration ตอนสตาร์ตและคุณจะ seed ทับมันอีกที ทั้งสองอย่างลบข้อมูลเดิม
> ฐานข้อมูล `getownly` ที่ใช้พัฒนาจะถูกแตะก็ต่อเมื่อคุณสั่งบน host เองเท่านั้น
> ไม่ใช่ผลข้างเคียงของการยกคอนเทนเนอร์
>
> เปลี่ยนชื่อได้ด้วย `GETOWNLY_DOCKER_DB=ชื่ออื่น` แต่**ตั้งเป็น `getownly` ไม่ได้** —
> คอนเทนเนอร์ `db-init` จะปฏิเสธและหยุดทั้งชุด

```bash
docker compose --profile full up --build     # ครั้งแรกใช้เวลาสัก 3-5 นาที
```

จากนั้นเปิด http://localhost:3000

ใส่ข้อมูลตัวอย่างเข้าไป (คอนเทนเนอร์ต้องรันอยู่):

```bash
# ข้อมูลพื้นฐาน: ผู้ใช้ หมวดหมู่ คอร์ส บทเรียน แบบทดสอบ
docker compose exec api sh -c "cd /app/backend && node_modules/.bin/tsx prisma/seed.ts"

# ข้อมูลสาธิตเพิ่มเติม: การซื้อ ความคืบหน้า ผลสอบ กระทู้ (ใช้ก่อนวันนำเสนอ)
docker compose exec api sh -c "cd /app/backend && node_modules/.bin/tsx prisma/demo-seed.ts"
```

หยุดเมื่อเสร็จ:

```bash
docker compose --profile full down
```

**สิ่งที่ควรรู้**

- โหมด `full` **เพิ่มคอนเทนเนอร์เข้าไปเท่านั้น** ไม่ได้แก้อะไรของสามตัวเดิม สองโหมดจึงไม่กวนกัน
- แต่ทั้งสองโหมดใช้พอร์ต 3000 และ 4000 เหมือนกัน **อย่ารันพร้อมกับ `pnpm dev`**
- ค่าที่ขึ้นต้นด้วย `NEXT_PUBLIC_` ถูกฝังลงใน bundle **ตอน build** ไม่ใช่ตอนรัน
  ถ้าจะเปลี่ยน (เช่นย้ายไปโดเมนจริง) ต้อง build image ใหม่ ไม่ใช่แค่แก้ตัวแปรสภาพแวดล้อม
- ไฟล์ `.env` ของเครื่องคุณ **ไม่ถูกคัดลอกเข้า image** (กันไว้ใน `.dockerignore`)
  ค่าที่คอนเทนเนอร์ใช้มาจาก `docker-compose.yml` ทั้งหมด
- `JWT_*_SECRET` และรหัสผ่านใน `docker-compose.yml` เป็นค่าสำหรับสาธิตเท่านั้น
  ต้องเปลี่ยนก่อนนำขึ้นใช้งานจริงทุกครั้ง

---

## สถาปัตยกรรม

```
เบราว์เซอร์
    │  httpOnly cookie (access 15 นาที / refresh 7 วัน)
    ▼
Next.js 15 (App Router) :3000
    │  middleware.ts กันเส้นทางตามบทบาท — เพื่อ UX เท่านั้น
    │  fetch พร้อม credentials: include
    ▼
NestJS :4000  /api
    │  JwtAuthGuard → RolesGuard → service (ตรวจความเป็นเจ้าของอีกชั้น)
    ├──────────────► PostgreSQL 16   ข้อมูลทั้งหมด + ledger
    ├──────────────► MinIO           วิดีโอ เอกสาร ปก สลิป
    └──────────────► Mailhog / SMTP  อีเมลตั้งรหัสผ่านใหม่
```

**ตรวจสิทธิ์สองชั้นเสมอ** — ชั้นแรกคือบทบาท (`@Roles(...)`) ชั้นที่สองคือความเป็นเจ้าของ
ทรัพยากร ซึ่งอยู่ใน service เท่านั้น เช่น "คอร์สนี้เป็นของผู้สอนคนนี้จริงไหม"
"ผู้ใช้คนนี้ลงทะเบียนคอร์สนี้แล้วจริงไหม" คำถามชุดหลังรวมอยู่ที่
`CourseAccessService` ที่เดียวทั้งระบบ

**วิดีโอไม่เคยออกจากระบบเป็น URL** — ไฟล์อยู่ใน MinIO แต่ผู้เรียนดูผ่าน
`GET /api/lessons/:id/stream` ที่ NestJS proxy ให้ รองรับ HTTP Range และตรวจสิทธิ์ทุก request
รวมถึงทุกครั้งที่เลื่อนแถบเวลา ส่วนเอกสารแนบและสลิปใช้ presigned URL อายุสั้นได้
เพราะตั้งใจให้ดาวน์โหลด

### โครงสร้างโปรเจกต์

```
getownly/
├─ backend/                     NestJS + Prisma (API)
│  ├─ prisma/
│  │  ├─ schema.prisma          โครงสร้างฐานข้อมูลทั้งหมด
│  │  ├─ migrations/
│  │  ├─ seed.ts                ข้อมูลตัวอย่างภาษาไทย
│  │  └─ demo-seed.ts           ประวัติย้อนหลังสำหรับวันสาธิต
│  ├─ src/
│  │  ├─ common/                guard, decorator, exception filter, error กลาง
│  │  ├─ config/                ตรวจ env ตอน boot + ตั้งค่า rate limit
│  │  ├─ infra/                 PrismaService, StorageService (MinIO), MailService
│  │  └─ modules/
│  │     ├─ auth/               สมัคร เข้าสู่ระบบ token rotation ตั้งรหัสผ่านใหม่
│  │     ├─ users/              โปรไฟล์ตัวเอง + จัดการผู้ใช้ของ ADMIN
│  │     ├─ categories/         หมวดหมู่ (สาธารณะ + CRUD ของ ADMIN)
│  │     ├─ courses/            แคตตาล็อก · สร้างคอร์ส · คิวอนุมัติของ ADMIN
│  │     ├─ lessons/            บทเรียน + สตรีมวิดีโอแบบ proxy
│  │     ├─ materials/          เอกสารแนบของบทเรียน
│  │     ├─ uploads/            presigned URL + กติกาชนิดและขนาดไฟล์
│  │     ├─ ledger/             เครื่องยนต์บัญชีคู่ + ตรรกะกระเป๋าเงิน
│  │     ├─ topups/             QR PromptPay · สลิป · คิวตรวจของ ADMIN
│  │     ├─ enrollments/        ซื้อคอร์ส + "คอร์สของฉัน"
│  │     ├─ learn/              ห้องเรียน + ความคืบหน้าการเรียน
│  │     ├─ quizzes/            สร้างข้อสอบ · ทำข้อสอบ · ตรวจให้คะแนน
│  │     ├─ qna/                กระดานถาม-ตอบ + กล่องคำถามของผู้สอน
│  │     └─ reports/            รายงานทั้งหมด (อ่านจาก LedgerEntry)
│  └─ test/                     harness ของเทสต์ (ฐานข้อมูลทดสอบ, factory, invariant)
├─ frontend/                    Next.js 15 App Router + Tailwind v4
│  ├─ src/app/globals.css       design token ทั้งหมดของระบบ
│  ├─ src/app/(public)/         หน้าแรก ค้นหาคอร์ส รายละเอียดคอร์ส
│  ├─ src/app/(auth)/           เข้าสู่ระบบ สมัคร ลืมรหัสผ่าน
│  ├─ src/app/(student)/        คอร์สของฉัน กระเป๋าเงิน ห้องเรียน แบบทดสอบ ถาม-ตอบ
│  ├─ src/app/(instructor)/     จัดการคอร์ส กล่องคำถาม รายงานยอดขาย
│  ├─ src/app/(admin)/          คิวสลิป คิวคอร์ส ผู้ใช้ หมวดหมู่ รายงาน
│  ├─ src/app/(account)/        โปรไฟล์ (ใช้ร่วมกันทุกบทบาท)
│  ├─ src/components/ui/        shadcn/ui ที่ปรับให้ใช้ token ของโปรเจกต์
│  ├─ src/lib/                  api client, type, ข้อความไทยรวมศูนย์, กราฟ
│  └─ src/middleware.ts         กันเส้นทางตามบทบาท
├─ packages/shared/             enum และ type ที่ FE/BE ใช้ร่วมกัน
├─ docker-compose.yml           postgres + minio + mailhog (+ api/web ใน profile `full`)
├─ CLAUDE.md                    กติกาการพัฒนา
└─ PLAN.md                      ขอบเขตและแผนงาน 8 เฟส
```

---

## แผนผังข้อมูล

```
User ─┬─ Account (USER_WALLET, 1:1)
      ├─ Course* ──┬─ Lesson* ─┬─ Material*
      │            │           ├─ Quiz (0..1) ── QuizQuestion* ── QuizChoice*
      │            │           └─ LessonProgress*
      │            ├─ Enrollment*
      │            └─ QnaThread* ── QnaReply*
      ├─ Enrollment* ── LessonProgress*
      ├─ QuizAttempt* ── QuizAttemptAnswer*
      ├─ TopupRequest*
      ├─ RefreshToken*
      └─ PasswordResetToken*

Category ── Course*

Account ── LedgerEntry* ── LedgerTransaction
                              │ idempotencyKey (unique)
                              └ referenceType + referenceId → TopupRequest | Enrollment
```

**ตารางที่เก็บ snapshot** (คัดลอกค่า ณ เวลาที่เกิดรายการ ห้าม join ไปอ่านค่าปัจจุบัน)

| ตาราง | คอลัมน์ที่เป็น snapshot | เหตุผล |
|---|---|---|
| `Enrollment` | `pricePaid`, `commissionRateSnapshot` | ราคาคอร์สและอัตราส่วนแบ่งแก้ไขทีหลังได้ ถ้าไม่ snapshot รายงานย้อนหลังจะเพี้ยนทั้งระบบ |

---

## ระบบบัญชีคู่

หัวใจของโปรเจกต์ ทุกบาทที่เคลื่อนไหวถูกบันทึกเป็น `LedgerTransaction` หนึ่งใบ
พร้อม `LedgerEntry` อย่างน้อย 2 แถวที่ **ผลรวม DEBIT เท่ากับผลรวม CREDIT เป๊ะ**
ระบบตรวจเงื่อนไขนี้ในโค้ดก่อน commit ทุกครั้ง ถ้าไม่ตรงจะ throw และ rollback ทั้ง transaction

### ผังบัญชีและทิศทางยอด

ยอดของทุกบัญชีคำนวณแบบ credit-normal คือ `balance = ผลรวม CREDIT − ผลรวม DEBIT`

| บัญชี | เจ้าของ | ทิศทางยอด |
|---|---|---|
| `USER_WALLET` | ผู้ใช้แต่ละคน | บวก — เงินที่แพลตฟอร์มค้างจ่ายให้ผู้ใช้ |
| `PLATFORM_REVENUE` | ระบบ (`ownerId = null`) | บวก — ส่วนแบ่งสะสมของแพลตฟอร์ม |
| `EXTERNAL_BANK` | ระบบ (`ownerId = null`) | **ลบ** — เงินที่ไหลเข้าระบบจากภายนอก |

ทำให้ **ผลรวม balance ของทุกบัญชีในระบบเท่ากับ 0 เสมอ** ซึ่งใช้เป็นตัวตรวจว่าบัญชียังถูกต้อง

### ตัวอย่างการเดินบัญชี

เติมเงิน 1,000 แล้วซื้อคอร์สราคา 1,000 จากผู้สอนที่ส่วนแบ่ง 30%

```
เติมเงิน   DEBIT  EXTERNAL_BANK    1000.00
           CREDIT กระเป๋าผู้เรียน    1000.00

ซื้อคอร์ส  DEBIT  กระเป๋าผู้เรียน    1000.00
           CREDIT กระเป๋าผู้สอน       700.00
           CREDIT PLATFORM_REVENUE   300.00
```

### กติกาที่บังคับไว้ในโค้ด

- จำนวนเงินทุกช่องเป็น `Decimal` ไม่ใช่ `Float` และ **ไม่แปลงเป็น `number` ระหว่างคำนวณเลย**
  API ส่งจำนวนเงินออกเป็น string เช่น `"1250.00"` เพื่อกัน float precision หลุดตอน JSON
- ปัดเศษ: คำนวณค่าธรรมเนียมแพลตฟอร์มก่อน (half-up 2 ตำแหน่ง) แล้ว
  **รายได้ผู้สอน = ราคา − ค่าธรรมเนียม** เสมอ ผลรวมจึงเท่าราคาพอดีไม่มีเศษหาย
- ทุก service ที่แตะเงินทำงานใน `prisma.$transaction` และ **ล็อกแถวบัญชีด้วย `SELECT ... FOR UPDATE`**
  เรียงตาม id เสมอเพื่อกัน deadlock
- `LedgerTransaction.idempotencyKey` เป็น unique (`topup:<id>` / `purchase:<id>`)
  กดปุ่มรัวหรือยิง API ซ้ำ 10 ครั้งพร้อมกัน เงินก็เข้าครั้งเดียว
- `LedgerTransaction` และ `LedgerEntry` เป็นแบบ **เขียนอย่างเดียว** ห้าม UPDATE ห้าม DELETE
  แก้ผิดด้วยการบันทึกรายการกลับรายการเท่านั้น
- **รายงานทุกหน้าอ่านจาก `LedgerEntry` ไม่ใช่จาก `Enrollment`** ตัวเลขบนหน้าจอจึงตรงกับ
  งบทดลองเสมอ และมีเทสต์ที่พิสูจน์ว่าผลรวมรายได้ของผู้สอนทุกคนเท่ากับยอดค้างจ่ายที่ ADMIN เห็น

---

## แผนผังหน้าจอ

| กลุ่ม | เส้นทาง | หน้าจอ |
|---|---|---|
| สาธารณะ | `/` · `/courses` · `/courses/[id]` | หน้าแรก · ค้นหาคอร์ส · รายละเอียดคอร์ส |
| เข้าสู่ระบบ | `/login` `/register` `/forgot-password` `/reset-password` | |
| ผู้เรียน | `/my-courses` | คอร์สที่ซื้อแล้ว + แถบความคืบหน้า |
| | `/wallet` · `/wallet/topup` | ยอดเงิน รายการเดินบัญชี QR PromptPay อัปโหลดสลิป |
| | `/learn/[courseId]` | ทางผ่าน — พาไปบทเรียนที่ยังไม่จบบทแรก |
| | `/learn/[courseId]/[lessonId]` | **หน้าเรียน** วิดีโอ + สารบัญ + เอกสาร + จำตำแหน่งที่ดูค้าง |
| | `/learn/[courseId]/quiz/[quizId]` · `/result` | ทำแบบทดสอบทีละข้อ · ผลและเฉลยรายข้อ |
| | `/learn/[courseId]/qna` · `/qna/[threadId]` | กระดานถาม-ตอบของคอร์ส · กระทู้และคำตอบ |
| ผู้สอน | `/instructor` · `/instructor/courses/[id]` | ภาพรวม · แก้ไขคอร์สและหลักสูตร + อัปโหลด |
| | `/instructor/qna` | กล่องคำถามรวมทุกคอร์ส เรียงจากที่รอนานที่สุด |
| | `/instructor/reports` | กราฟแท่งรายได้ 6 เดือน + ตารางยอดขายรายคอร์ส |
| ผู้ดูแล | `/admin` | ภาพรวม งานค้างในแต่ละคิว + ตัวเลข 30 วันล่าสุด |
| | `/admin/topups` | คิวตรวจสลิป — ดูสลิปคู่กับจำนวนเงินแล้วอนุมัติ/ปฏิเสธ |
| | `/admin/courses` | คิวอนุมัติคอร์ส พร้อมรายการบทเรียนให้ตรวจก่อนตัดสิน |
| | `/admin/users` | ตารางผู้ใช้ ระงับบัญชี ตั้งอัตราส่วนแบ่งรายบุคคล |
| | `/admin/categories` | เพิ่ม แก้ไข ลบหมวดหมู่ |
| | `/admin/reports` | การ์ดสถิติ 4 ใบ + กราฟเส้นรายวัน + 5 อันดับคอร์ส/ผู้สอน |
| ทุกบทบาท | `/profile` | แก้ไขชื่อที่แสดง แนะนำตัว และเปลี่ยนรหัสผ่าน |

---

## การทดสอบ

เทสต์ **รันกับ PostgreSQL และ Mailhog จริงใน Docker ไม่ใช้ mock** เพราะความถูกต้องของบัญชีคู่
ขึ้นกับ transaction และ row lock ที่ฐานข้อมูลให้จริงเท่านั้น ส่วน object storage ใช้
`FakeStorage` แทน MinIO เพราะสิ่งที่ต้องพิสูจน์คือ "ขอ key ไหน" และ "ลบ key ไหน"

```bash
pnpm docker:up     # ต้องยกฐานข้อมูลขึ้นก่อน
pnpm test
```

| ไฟล์ | ครอบอะไร |
|---|---|
| `modules/ledger/ledger.service.spec.ts` | เครื่องยนต์บัญชีคู่ · idempotency · `computeBalance` |
| `modules/ledger/wallet.service.spec.ts` | เติมเงิน · ซื้อคอร์ส · การปัดเศษ · การยิงซ้ำพร้อมกัน |
| `modules/courses/courses.service.spec.ts` | แคตตาล็อก · ความเป็นเจ้าของ · การมองเห็นตามสถานะ |
| `modules/courses/course-review.service.spec.ts` | คิวอนุมัติคอร์สของ ADMIN |
| `modules/lessons/lessons.service.spec.ts` | บทเรียน · การจัดลำดับ · Range header ของวิดีโอ |
| `modules/uploads/uploads.service.spec.ts` | กติกาชนิดและขนาดไฟล์ · สิทธิ์ในการเซ็น URL |
| `modules/topups/topups.service.spec.ts` | QR · สลิป · คิวตรวจ · เพดานคำขอค้าง |
| `modules/enrollments/enrollments.service.spec.ts` | "คอร์สของฉัน" + snapshot ราคา |
| `modules/learn/learn.service.spec.ts` | ห้องเรียน · ความคืบหน้า · การจำตำแหน่งวิดีโอ |
| `modules/quizzes/quizzes.service.spec.ts` | สร้างข้อสอบ · **ไม่ส่งเฉลยตอนทำข้อสอบ** · การให้คะแนน |
| `modules/qna/qna.service.spec.ts` | สิทธิ์บนกระดานถาม-ตอบ · กล่องคำถามของผู้สอน |
| `modules/users/users.service.spec.ts` | โปรไฟล์ · เปลี่ยนรหัสผ่าน · ระงับบัญชี · อัตราส่วนแบ่ง |
| `modules/categories/categories.service.spec.ts` | CRUD หมวดหมู่ · กันลบหมวดที่มีคอร์สอยู่ |
| `modules/reports/reports.service.spec.ts` | **รายงานตรงกับ ledger** · การเทียบช่วงเวลา · 5 อันดับ |
| `common/guards/roles.guard.spec.ts` | การตรวจบทบาท |
| `test/auth.e2e.spec.ts` | สมัคร เข้าสู่ระบบ หมุน token ลืมรหัสผ่าน rate limit (ผ่าน supertest) |

- เทสต์ใช้ฐานข้อมูลชื่อ **`getownly_test`** บน container เดียวกับฐานข้อมูลพัฒนา
  ระบบสร้างและ migrate ให้เองอัตโนมัติในการรันครั้งแรก (`backend/test/global-setup.ts`)
- ข้อมูลพัฒนาในฐานข้อมูล `getownly` **ไม่ถูกแตะต้อง** — ทุกเทสต์ TRUNCATE เฉพาะฐานข้อมูลทดสอบ
- `backend/test/invariants.ts` รวบรวมค่าคงที่ทางบัญชี 3 ข้อที่ต้องเป็นจริงเสมอ
  (ทุกรายการ debit = credit · `Account.balance` ตรงกับยอดที่คำนวณจาก ledger ·
  ผลรวมทุกบัญชีเป็น 0) และถูกเรียกท้ายเทสต์ที่แตะเงินทุกข้อ

---

## แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุและวิธีแก้ |
|---|---|
| `P1000: Authentication failed` ตอน `pnpm db:migrate` | มี PostgreSQL ตัวอื่นบนเครื่องครองพอร์ตอยู่ ตรวจด้วย `Get-NetTCPConnection -LocalPort 5433 -State Listen` และดูว่า `docker compose ps` ขึ้น `0.0.0.0:5433->5432/tcp` จริง |
| `Cannot find module '@prisma/client'` หรือ type ของ Prisma หายไป | รัน `pnpm db:generate` (ปกติ `pnpm install` จะ generate ให้เองผ่าน postinstall ของ backend) |
| `ESLint couldn't find the plugin ...` ในฝั่ง frontend | ลบ `node_modules` แล้ว `pnpm install` ใหม่ ค่า `public-hoist-pattern` ใน `.npmrc` ต้องถูกใช้งานตอนติดตั้ง |
| `port is already allocated` ตอน `pnpm docker:up` | มีบริการอื่นใช้พอร์ต 9100/9101/1025/8025 อยู่ ปิดบริการนั้นหรือแก้พอร์ตใน `docker-compose.yml` |
| `ports are not available ... forbidden by its access permissions` (Windows) | **ไม่ได้แปลว่ามีใครใช้พอร์ตอยู่** แต่ Windows จองช่วงพอร์ตนั้นไว้เอง ดูด้วย `netsh interface ipv4 show excludedportrange protocol=tcp` · แก้ด้วยการรีสตาร์ต WinNAT ใน PowerShell แบบผู้ดูแล: `net stop winnat` แล้ว `net start winnat` |
| `EADDRINUSE :4000` ตอน `pnpm dev` | มี backend ค้างอยู่จากรอบก่อน ปิดด้วย `Get-NetTCPConnection -LocalPort 4000 -State Listen` แล้ว `Stop-Process` |
| ข้อมูลเพี้ยนหรืออยากเริ่มใหม่ทั้งหมด | `pnpm docker:reset` แล้วตามด้วย `pnpm db:migrate` และ `pnpm db:seed` |
| `pnpm test` ล้มตั้งแต่ยังไม่เริ่มเทสต์ | ยังไม่ได้ยก Docker ขึ้น รัน `pnpm docker:up` ก่อน เทสต์ต้องต่อฐานข้อมูลจริง |
| อยากล้างฐานข้อมูลทดสอบทิ้ง | `docker compose exec postgres dropdb -U getownly getownly_test` แล้วรัน `pnpm test` ใหม่ ระบบจะสร้างให้เอง |
| หน้ารายงานว่างเปล่า ไม่มีกราฟ | ฐานข้อมูลยังไม่มีการซื้อขาย รัน `pnpm demo:reset` เพื่อสร้างประวัติย้อนหลัง |
| กดเล่นวิดีโอแล้วไม่มีภาพ | ข้อมูล seed ชี้ไปยัง object ที่ยังไม่มีไฟล์จริงใน MinIO ต้องอัปโหลดวิดีโอผ่านหน้าผู้สอนก่อน |

---

## ข้อจำกัดที่ทราบ

**เรื่องการเงิน**

- **ไม่มีการเชื่อมต่อ payment gateway และไม่มีการตรวจสอบยอดเงินอัตโนมัติ**
  การเติมเงินทุกครั้งต้องให้ผู้ดูแลระบบตรวจสลิปด้วยตาเอง ระบบไม่มีทางรู้ว่าสลิปจริงหรือปลอม
  ลดความเสี่ยงด้วย QR ที่ระบุจำนวนเงินตายตัวและการแสดงประวัติผู้ใช้ให้ผู้ดูแลดูประกอบเท่านั้น
- `PROMPTPAY_ID` ใน `.env.example` เป็น `0000000000` โดยตั้งใจ และ `DEMO_MODE=true`
  ทำให้ทุกหน้าจอที่แสดง QR ขึ้นคำเตือนว่าเป็น QR สาธิต **ยังไม่ได้ทดสอบสแกนด้วยแอปธนาคารจริง**
  สิ่งที่พิสูจน์แล้วคือ payload เป็นรูปแบบ EMVCo ถูกต้องและ CRC ตรงกับที่คำนวณแยกต่างหาก
- **ยังไม่มีการถอนเงินของผู้สอน** รายได้สะสมอยู่ในกระเป๋าเงินของผู้สอนในระบบ
  รายงาน "ยอดค้างจ่ายผู้สอน" จึงเท่ากับรายได้สะสมทั้งหมด เมื่อทำการถอนเงินต้องหักยอดที่ถอนแล้วออก

**เรื่องขอบเขตที่ยังไม่ได้ทำ**

- **ตะกร้าสินค้า** — ซื้อได้ทีละคอร์สผ่านปุ่มในหน้ารายละเอียดคอร์ส ยังไม่มี `Order`/`OrderItem`
- **ใบประกาศนียบัตร** — ยังไม่มี model `Certificate` และหน้าตรวจสอบสาธารณะ
- **รีวิวและให้ดาว** — ยังไม่มี model `Review`
- **ระบบแจ้งเตือน** — ผู้สอนต้องเปิดกล่องคำถามเอง ระบบไม่ส่งอีเมลหรือแจ้งเตือนในเว็บ
  เมื่อมีคำถามใหม่หรือมีคนซื้อคอร์ส (อีเมลที่ทำงานจริงมีเฉพาะการตั้งรหัสผ่านใหม่)
- **หน้าจอสร้างข้อสอบของผู้สอน** — API ครบแล้ว (`POST /lessons/:id/quiz` และ
  `PATCH`/`DELETE /quizzes/:id`) แต่ยังไม่มีหน้าจอเรียกใช้ แบบทดสอบที่เห็นบนเว็บมาจาก seed
- **อัปโหลดรูปโปรไฟล์** — แก้ชื่อและแนะนำตัวได้ แต่ยังไม่มีการเปลี่ยนรูป

**เรื่องเทคนิค**

- วิดีโอเก็บเป็นไฟล์ MP4 และส่งผ่าน API โดยตรง **ไม่มีการแปลงไฟล์เป็น HLS**
  จึงไม่รองรับการปรับความละเอียดอัตโนมัติ และมีข้อจำกัดเรื่องจำนวนผู้ชมพร้อมกัน
  เพราะทุกสายสตรีมกิน bandwidth ของเซิร์ฟเวอร์ API
- อีเมลในโหมดพัฒนาส่งเข้า Mailhog เท่านั้น **ต้องต่อ SMTP จริงก่อนใช้งานจริง**
  และต้องตั้งค่า SPF/DKIM ไม่งั้นอีเมลจะเข้า spam
- ค้นหาคอร์สและกระทู้ใช้ `LIKE` ธรรมดา ข้อมูลระดับปริญญานิพนธ์ยังเร็วพอ
  แต่ถ้าข้อมูลโตมากควรพิจารณา full-text search ของ PostgreSQL
- ยังไม่มี `AuditLog` บันทึกการกระทำของผู้ดูแลระบบ
- ยังไม่มีเทสต์ e2e ด้วย Playwright — การทดสอบครอบชั้น service และ API เป็นหลัก
