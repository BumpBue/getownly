# เช็กลิสต์กรอก Environment Variables บน Render

ไฟล์นี้สำหรับกรอกตามเท่านั้น ไม่ต้อง commit เข้า git (มีอยู่ใน `.gitignore` แล้วหรือยังก็ได้ —
ดูหมายเหตุท้ายไฟล์) **ถ้าพิมพ์ค่าจริงลงในไฟล์นี้ระหว่างกรอก ห้ามเอาไฟล์นี้ไป push ขึ้น GitHub เด็ดขาด**

**วิธีใช้:** ไปที่ Render → เลือก service `getownly-api` → แท็บ **Environment** →
กรอกทีละตัวตามชื่อในคอลัมน์ "ชื่อตัวแปร" ให้ตรงตัวพิมพ์ใหญ่เล็กเป๊ะๆ (คัดลอกจากตารางได้เลย)
ตัวแปรอื่นๆ ที่ไม่อยู่ในเช็กลิสต์นี้ (`NODE_ENV`, `COOKIE_SECURE` ฯลฯ) มากับ `render.yaml` ให้แล้ว
ไม่ต้องกรอกเพิ่ม

**ลำดับที่แนะนำ:** ทำกลุ่ม 1–3 ให้เสร็จก่อน (ไม่ต้องรออะไร) ส่วนกลุ่ม 4 ต้องรอ Vercel/Resend เสร็จก่อนค่อยกลับมากรอก

---

## กลุ่ม 1 — มีอยู่แล้วจาก Supabase

☐ สร้างโปรเจกต์ Supabase ให้เสร็จก่อน แล้วไปที่ **หน้าโปรเจกต์ → ปุ่ม "Connect" มุมขวาบน**
(หรือ Project Settings → Database ก็ไปหน้าเดียวกัน) → แท็บ **Connection String**

| ☐ | ชื่อตัวแปร | หาได้จากไหน | ตัวอย่างรูปแบบ (ไม่ใช่ค่าจริง) |
|---|---|---|---|
| ☐ | `DATABASE_URL` | ในแท็บ Connection String ให้เลือกโหมด **"Session pooler"** (ไม่ใช่ "Transaction pooler" และไม่ใช่ "Direct connection" — ดูเหตุผลด้านล่าง) แล้วกด Copy จะได้ URI ทั้งเส้น จากนั้นแทนที่ `[YOUR-PASSWORD]` ในนั้นด้วยรหัสผ่านฐานข้อมูลที่ตั้งไว้ตอนสร้างโปรเจกต์ (ถ้าจำไม่ได้ กด "Reset database password" ในหน้าเดียวกันได้) | `postgresql://postgres.abcdefghijkl:รหัสผ่านของคุณ@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres` |

> ⚠️ **ทำไมต้อง "Session pooler" ไม่ใช่ "Transaction pooler"** — ระบบนี้ใช้ `DATABASE_URL` ตัวเดียว
> ทั้งรันคำสั่งสร้างตาราง (`prisma migrate deploy` ที่รันอัตโนมัติทุกครั้งที่เริ่มระบบ) และคำสั่งอ่าน/เขียน
> ข้อมูลตามปกติ โหมด "Transaction pooler" (พอร์ต 6543) มีข้อจำกัดกับคำสั่งสร้างตารางแบบนี้
> โหมด "Session pooler" (พอร์ต 5432) ใช้ได้ทั้งสองแบบในเส้นทางเดียว ปลอดภัยกว่าสำหรับระบบนี้

---

## กลุ่ม 2 — มีอยู่แล้วจาก Cloudflare R2

☐ สร้าง bucket และ API token บน R2 ให้เสร็จก่อน (Cloudflare dashboard → เมนูซ้าย **R2 Object Storage**)

| ☐ | ชื่อตัวแปร | หาได้จากไหน | ตัวอย่างรูปแบบ (ไม่ใช่ค่าจริง) |
|---|---|---|---|
| ☐ | `MINIO_BUCKET` | กด **Create bucket** → ตั้งชื่อเอง (เช่น `getownly-media`) → ใช้ชื่อเดียวกันนี้กรอกที่นี่ | `getownly-media` |
| ☐ | `MINIO_ENDPOINT` | เข้า bucket ที่สร้างไว้ → แท็บ **Settings** → หัวข้อ **"S3 API"** จะโชว์ endpoint เต็มรูปแบบ `https://<account-id>.r2.cloudflarestorage.com` — **คัดลอกเฉพาะส่วนชื่อโฮสต์ ตัด `https://` ออก** เพราะตัวแปรนี้เก็บแค่ชื่อโฮสต์ ไม่มี `https://` นำหน้า | `1a2b3c4d5e6f7g8h9i0j.r2.cloudflarestorage.com` |
| ☐ | `MINIO_PUBLIC_ENDPOINT` | **ค่าเดียวกันกับ `MINIO_ENDPOINT` เป๊ะๆ** (คัดลอกวางซ้ำ) — R2 มี endpoint เดียวที่ทั้งเซิร์ฟเวอร์และเบราว์เซอร์ใช้ร่วมกันได้ ไม่ต้องหาค่าที่สอง | `1a2b3c4d5e6f7g8h9i0j.r2.cloudflarestorage.com` |
| ☐ | `MINIO_ACCESS_KEY` | จากเมนู R2 → **"Manage R2 API Tokens"** → **Create API Token** → สิทธิ์เลือก "Object Read & Write" → จำกัดเฉพาะ bucket ที่สร้างไว้ได้ → กด Create → หน้าจะโชว์ **Access Key ID** ให้คัดลอก | `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6` |
| ☐ | `MINIO_SECRET_KEY` | โผล่มาพร้อมกันในหน้าเดียวกับ Access Key ID ด้านบน คือ **Secret Access Key** | `AbCdEf1234567890GhIjKlMnOpQrStUvWxYz1234` |

> ⚠️ **Secret Access Key โชว์ให้เห็นครั้งเดียวตอนสร้างเท่านั้น** ปิดหน้านี้ไปแล้วกลับมาดูซ้ำไม่ได้
> ต้องคัดลอกไปวางไว้ที่ปลอดภัย (หรือกรอกใส่ Render ทันที) ก่อนปิดหน้าต่างนั้น ถ้าพลาดต้องสร้าง token ใหม่

---

## กลุ่ม 3 — ต้องสุ่มเอง

☐ เปิด Terminal เครื่องตัวเอง (Git Bash / Terminal / PowerShell ก็ได้) แล้วรันคำสั่งนี้ **สองครั้งแยกกัน**
เพื่อให้ได้ค่าคนละตัว (ห้ามใช้ค่าเดียวกันซ้ำสองตัวแปร):

```bash
openssl rand -hex 32
```

แต่ละครั้งจะได้ข้อความยาว 64 ตัวอักษร (ตัวเลข+ตัวอักษร a-f) คัดลอกไปกรอกตามตาราง

| ☐ | ชื่อตัวแปร | มาจาก | ตัวอย่างรูปแบบ (ไม่ใช่ค่าจริง) |
|---|---|---|---|
| ☐ | `JWT_ACCESS_SECRET` | รัน `openssl rand -hex 32` ครั้งที่ 1 | `9f2a7c1e4b8d3f6a0c5e9b2d7f1a4c8e6b0d3f7a1c5e9b2d4f8a0c6e2b7d1f4a` |
| ☐ | `JWT_REFRESH_SECRET` | รัน `openssl rand -hex 32` ครั้งที่ 2 (ต้องเป็นค่าที่ต่างจาก `JWT_ACCESS_SECRET`) | `3e8b1d5a9c2f6e0b4d7a1c5e9b3f7a0d4c8e2b6f0a3d7c1e5b9f2a6d0c4e8b1a` |

ถ้าเครื่องไม่มี `openssl` (เช่น PowerShell ล้วนไม่มีการติดตั้งเพิ่ม) ใช้คำสั่งนี้แทนได้ ให้ผลแบบเดียวกัน:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## กลุ่ม 4 — ยังไม่มี ต้องรอ

### 4ก. รอ Vercel deploy เสร็จก่อน

| ☐ | ชื่อตัวแปร | รอ | ตัวอย่างรูปแบบ (ไม่ใช่ค่าจริง) |
|---|---|---|---|
| ☐ | `FRONTEND_ORIGIN` | deploy frontend ขึ้น Vercel ให้เสร็จก่อน แล้วคัดลอก URL ที่ Vercel ให้มา **ห้ามมี `/` ต่อท้าย** | `https://getownly.vercel.app` |

### 4ข. รอสมัครผู้ให้บริการ SMTP ก่อน (เช่น Resend)

ยังไม่ได้สมัคร Resend หรือผู้ให้บริการ SMTP ตัวไหนก็ได้ — เมื่อสมัครแล้วค่อยกลับมากรอกกลุ่มนี้
ตัวอย่างด้านล่างเป็นรูปแบบของ **Resend** โดยเฉพาะ (ถ้าใช้เจ้าอื่นเช่น SendGrid/Brevo ค่าจะหน้าตาต่างไป
แต่กรอกในตัวแปรเดียวกันนี้)

| ☐ | ชื่อตัวแปร | หาได้จากไหน (กรณีใช้ Resend) | ตัวอย่างรูปแบบ (ไม่ใช่ค่าจริง) |
|---|---|---|---|
| ☐ | `MAIL_HOST` | ค่าคงที่ของ Resend เสมอ ไม่ต้องหาจากไหน | `smtp.resend.com` |
| ☐ | `MAIL_PORT` | ค่าคงที่ของ Resend เสมอ | `587` |
| ☐ | `MAIL_SECURE` | ต้องเป็น `false` คู่กับพอร์ต 587 ด้านบน (ถ้าใช้พอร์ต 465 แทน ต้องเป็น `true`) | `false` |
| ☐ | `MAIL_USER` | ค่าคงที่ของ Resend เสมอ (ไม่ใช่อีเมลของคุณ) | `resend` |
| ☐ | `MAIL_PASSWORD` | สมัคร resend.com → **API Keys** → Create API Key → คัดลอกค่าที่ขึ้นต้นด้วย `re_` | `re_AbCdEfGh_1234567890abcdefghij` |
| ☐ | `MAIL_FROM_NAME` | ตั้งเองได้เลย ไม่ต้องรอใคร | `getownly` |
| ☐ | `MAIL_FROM_ADDRESS` | ต้องเป็นอีเมลบนโดเมนที่ยืนยันความเป็นเจ้าของกับ Resend แล้วเท่านั้น (Resend → Domains → Add Domain → ไปตั้งค่า DNS ตามที่บอก) ใช้อีเมลปลอมๆ ที่ไม่ได้ยืนยันโดเมนไม่ได้ ส่งไม่ออก | `no-reply@yourdomain.com` |

---

## ตรวจทานก่อนกด Deploy

- [ ] ครบทั้ง 16 ตัวแปรในเช็กลิสต์นี้ (นับจากจำนวน ☐ ด้านบน)
- [ ] `JWT_ACCESS_SECRET` กับ `JWT_REFRESH_SECRET` เป็นคนละค่ากัน
- [ ] `MINIO_ENDPOINT` และ `MINIO_PUBLIC_ENDPOINT` เหมือนกันเป๊ะ และ **ไม่มี** `https://` นำหน้า
- [ ] `FRONTEND_ORIGIN` ไม่มี `/` ต่อท้าย
- [ ] ไม่มีช่องว่างเผลอติดหัว-ท้ายค่าไหนเลย (คัดลอกมาจากที่อื่นมักติดมาโดยไม่รู้ตัว)

---

## กลุ่ม 5 — Vercel Frontend

> ⚠️ **ต้อง deploy backend บน Render ให้เสร็จก่อน** ถึงจะรู้ URL จริงมากรอกกลุ่มนี้ได้
> (deploy Vercel ครั้งแรกด้วยค่าใดก็ได้ไปก่อนก็ได้ แล้วค่อยกลับมาแก้ตามนี้ + กด redeploy อีกที
> ตามขั้นตอน "ปิดวงจร" ในหัวข้อ Deploy ออนไลน์ของ README.md)

Vercel ตรวจเจอ 4 ชื่อนี้จากการสแกน `frontend/.env.example` ในโค้ด ไม่ใช่ทั้ง 4 ตัวถูกใช้งานจริงเท่ากัน
— ไล่โค้ดจริงแล้วพบว่า **2 ตัวทำงานจริง และ 2 ตัวไม่มีอะไรอ่านค่าเลยในตอนนี้** รายละเอียดตัวต่อตัว:

### `NEXT_PUBLIC_API_BASE_URL`

1. **ใช้จริงที่** [`frontend/src/lib/api-client.ts:12`](frontend/src/lib/api-client.ts#L12) — `const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api"`
2. **ทำหน้าที่:** เป็น URL ที่**เบราว์เซอร์**ยิง `fetch` ไปหา API โดยตรง (ฟังก์ชัน `apiRequest`/`apiUrl` ทุกจุดที่โค้ดฝั่ง client เรียก API) เพราะขึ้นต้นด้วย `NEXT_PUBLIC_` ค่านี้จึงถูกฝังลงใน JavaScript bundle ตอน build และเบราว์เซอร์ของผู้ใช้ทุกคนอ่านเห็นได้ (ไม่ใช่ความลับ ไม่ใส่อะไรที่เป็นความลับในนี้ได้อยู่แล้วเพราะเป็นแค่ URL)
3. **ค่าที่ควรใส่:** URL ของ Render backend + `/api` เช่น `https://getownly-api.onrender.com/api` (ดู URL จริงที่มุมบนของหน้า service บน Render หลัง deploy เสร็จ — ชื่ออาจไม่ตรงเป๊ะกับ `getownly-api` ถ้าชื่อนั้นถูกใช้ไปแล้ว)
4. **มี default ในโค้ด** (`"http://localhost:4000/api"`) จึง build ผ่านแน่นอนแม้ไม่ตั้งค่า แต่ default นั้นใช้งานจริงบน Vercel ไม่ได้เลย (เบราว์เซอร์ของผู้ใช้จะพยายามต่อ `localhost:4000` ของเครื่องตัวเอง ไม่ใช่ของ Render) **จึงต้องตั้งค่าจริงเสมอ แม้โค้ดจะไม่บังคับก็ตาม**

### `API_BASE_URL`

1. **ใช้จริงที่** [`frontend/src/lib/server-api.ts:13-14`](frontend/src/lib/server-api.ts#L13-L14) — `process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api"`
2. **ทำหน้าที่:** เป็น URL ที่ **Server Component ฝั่ง Next.js** ใช้เรียก API (ฟังก์ชัน `serverFetch` ที่ import `next/headers` — รันบนเซิร์ฟเวอร์ของ Vercel เท่านั้น ไม่เคยลงไปถึงเบราว์เซอร์) ยืนยันจากโค้ดจริงว่าต่างกันตรงนี้: `api-client.ts` (browser) อ่านแค่ `NEXT_PUBLIC_API_BASE_URL` ตัวเดียว ไม่มี fallback อื่น ส่วน `server-api.ts` (server) **ลองอ่าน `API_BASE_URL` (ไม่มี prefix) ก่อน** แล้วค่อย fallback ไปที่ `NEXT_PUBLIC_API_BASE_URL` — เหตุผลของการมีสองชื่อคือใน Docker local ทั้งสองค่าต่างกัน (ดู `docker-compose.yml:207,217`): `API_BASE_URL=http://api:4000/api` (ชื่อ container ในเครือข่ายภายใน ใช้ได้เฉพาะจากใน container `web`) ส่วน `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api` (ที่เบราว์เซอร์บนเครื่องคนใช้งานเข้าถึงได้) — **บน Vercel ไม่มีเครือข่ายภายในแบบนั้น ทั้งเซิร์ฟเวอร์ของ Vercel และเบราว์เซอร์ต่างก็ต้องออกไปทาง URL สาธารณะของ Render เหมือนกัน สองค่านี้จึงควรเท่ากันเป๊ะบน Vercel**
3. **ค่าที่ควรใส่:** **ค่าเดียวกับ `NEXT_PUBLIC_API_BASE_URL` เป๊ะ** เช่น `https://getownly-api.onrender.com/api`
4. **มี default ในโค้ด** เหมือนกัน (`"http://localhost:4000/api"` ผ่าน fallback) แต่ใช้งานจริงบน Vercel ไม่ได้ด้วยเหตุผลเดียวกับข้อบน — **ต้องตั้งค่าจริงเสมอ**

### `NEXT_PUBLIC_SITE_URL`

1. **ไม่มีที่ไหนใน `frontend/src` อ่านค่านี้เลย** (ไล่ `grep -rn "process.env" frontend/src` ทั้งโฟลเดอร์แล้ว เจอแค่ 2 บรรทัดของ `API_BASE_URL` สองตัวข้างบนเท่านั้น) — ปรากฏแค่ใน `frontend/.env.example:18` และเป็น build `ARG`/`ENV` เปล่าๆ ใน `frontend/Dockerfile:30,34` ที่ไม่มีอะไรอ่านต่อ
2. **คอมเมนต์ใน `.env.example` เขียนไว้ว่า** "ใช้สร้างลิงก์ในอีเมลและหน้าใบประกาศนียบัตร" **แต่ไม่จริงในโค้ดตอนนี้** — ฟีเจอร์ใบประกาศนียบัตรยังไม่มีอยู่จริงในระบบเลย (อยู่ในรายการ "ยังไม่มี" ของ CLAUDE.md) ส่วนอีเมลที่มีอยู่ (ลิงก์ reset รหัสผ่าน) เป็นโค้ดฝั่ง **backend** (`backend/src/infra/mail/`) ซึ่งเป็นคนละ process คนละ env กันโดยสิ้นเชิง ไม่ได้อ่านตัวแปรนี้จากฝั่ง frontend — คอมเมนต์นี้เป็นความตั้งใจในอนาคตที่ยังไม่ได้ต่อโค้ดจริง ไม่ใช่ของที่ใช้งานอยู่
3. **ค่าที่ควรใส่:** URL ของ Vercel เอง เช่น `https://getownly.vercel.app` — ใส่ให้ถูกไว้ก่อนเผื่ออนาคตมีโค้ดมาอ่าน จะได้ไม่ต้องมาตามหาว่าตั้งถูกไหม แม้ตอนนี้จะยังไม่มีผลอะไรกับหน้าจอเลยก็ตาม
4. **ไม่มีอะไรอ่านค่านี้เลย จึงไม่มีทั้ง "จำเป็น" และ "default" ในความหมายปกติ** — ใส่ผิด ใส่ถูก หรือไม่ใส่เลย **ไม่กระทบการทำงานของเว็บในตอนนี้แม้แต่นิดเดียว**

### `NEXT_PUBLIC_SITE_NAME`

1. **ไม่มีที่ไหนใน `frontend/src` อ่านค่านี้เลยเช่นกัน** ปรากฏแค่ใน `frontend/.env.example:21` และ `frontend/Dockerfile:31,35` เหมือนตัวข้างบน
2. **คอมเมนต์ใน `.env.example` เขียนไว้ว่า** "แสดงในส่วนท้ายเว็บ (footer) และเอกสารที่พิมพ์ได้" **แต่ก็ไม่จริงเช่นกัน** — เปิด [`frontend/src/components/shared/Footer.tsx`](frontend/src/components/shared/Footer.tsx) แล้วดูจริงๆ พบว่าชื่อแบรนด์ที่ขึ้นในหน้าเว็บ (`{brand.name}` บรรทัด 25, 47, 87) มาจาก `authMessages.brand.name` ซึ่งเป็นข้อความไทยตายตัวใน `frontend/src/lib/messages/auth.ts` **ไม่ได้อ่านจาก env var ตัวนี้เลย**
3. **ค่าที่ควรใส่:** `getownly` (ตามค่าเริ่มต้นใน `.env.example`) หรือชื่อที่ต้องการ — เหตุผลเดียวกับข้อบน คือใส่ไว้เผื่ออนาคต
4. **ไม่มีอะไรอ่านค่านี้เลยเช่นกัน** ใส่หรือไม่ใส่ **ไม่กระทบหน้าจอปัจจุบันแม้แต่นิดเดียว**

| ☐ | ชื่อตัวแปร | ค่าที่ควรใส่ | จำเป็นจริงไหม |
|---|---|---|---|
| ☐ | `NEXT_PUBLIC_API_BASE_URL` | URL ของ Render + `/api` | **จำเป็น** — โค้ดมี default แต่ใช้บน Vercel จริงไม่ได้ |
| ☐ | `API_BASE_URL` | ค่าเดียวกับข้างบนเป๊ะ | **จำเป็น** — เหตุผลเดียวกัน |
| ☐ | `NEXT_PUBLIC_SITE_URL` | URL ของ Vercel เอง | ไม่จำเป็น — ยังไม่มีโค้ดอ่านค่านี้เลย ใส่ไว้เผื่ออนาคต |
| ☐ | `NEXT_PUBLIC_SITE_NAME` | `getownly` | ไม่จำเป็น — ยังไม่มีโค้ดอ่านค่านี้เลย ใส่ไว้เผื่ออนาคต |

---

*ไฟล์นี้สร้างไว้เพื่อกรอกอ้างอิงเท่านั้น ไม่ใช่ส่วนหนึ่งของระบบที่รันจริง — ลบทิ้งได้เมื่อกรอกเสร็จแล้ว*
