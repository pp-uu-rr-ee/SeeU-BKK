# SeeU Bangkok — สถานะโปรเจกต์

อัปเดตล่าสุด: 28 ต.ค. 2026 · commit ล่าสุด `ead5d33 fix profile page`

## 1. โปรเจกต์นี้ควรทำอะไร

เว็บช่วยเที่ยว **เกาะรัตนโกสินทร์ / เมืองเก่ากรุงเทพฯ** สองภาษา (ไทย/อังกฤษ)

| ความสามารถ | ผู้ใช้ทำอะไรได้ |
|---|---|
| ค้นหาสถานที่ | ค้นตามชื่อ (ไทย/อังกฤษ), หมวดหมู่, ดูรายละเอียดจริง (เวลาเปิด-ปิด, ราคา, ติดต่อ, รีวิว) |
| แผนที่ | ดูหมุดบน Mapbox, เลือกสถานที่ใส่ทริป, ดูเส้นทาง/ระยะเดิน |
| ผู้ช่วย AI | ถามเป็นภาษาธรรมชาติ → multi-agent (researcher / planner / critic บน LangGraph) ค้นจากฐานข้อมูลด้วย vector search แล้วร่างเส้นทาง |
| บัญชีผู้ใช้ | สมัคร/ล็อกอิน (Supabase Auth), โปรไฟล์ + แบบสอบถามความชอบ, บันทึกทริป, รายการโปรด, เขียนรีวิว |
| Admin | เพิ่ม/แก้ไขสถานที่, เวลาเปิด-ปิด, สร้าง embedding |

**Stack:** Turborepo + Bun · `apps/web` Next.js 16 / React 19 / Tailwind 4 (port 3001) · `apps/server` Hono บน Bun (port 3000) · Supabase (Postgres + pgvector + Auth + Storage, project `SeeU-BKK` / `ihdcpucmdyprgbykbuvs`) · OpenAI (`gpt-4o-mini`, `gpt-5-nano`, `gpt-5.4-mini`, `text-embedding-3-small`) · Mapbox

## 2. สิ่งที่ทำไปแล้ว

### การตั้งค่าให้รันบน localhost
- สร้าง `apps/server/.env` และ `apps/web/.env.local` และใส่ key ของ Supabase, OpenAI และ Mapbox ครบแล้ว
- เพิ่ม `.claude/launch.json` สำหรับรัน server และ web
- เจอและแก้ปัญหา: บัญชี OpenAI **เครดิตหมด** (HTTP 429) ทำให้ chat ใช้ไม่ได้ ต้องเติมเครดิตเอง

### ฐานข้อมูล (Supabase)
- สร้างฟังก์ชัน `match_places` ที่เดิมไม่มีในฐานข้อมูล ซึ่งทำให้ vector search ใช้ไม่ได้ เพิ่มการกรอง `is_published`, ค้นคอลัมน์ไทย และ `search_path`
- ตารางใหม่ (migration อยู่ใน `apps/server/sql/place_details_tables.sql`):
  - `place_opening_hours`
  - `place_reviews` + view `place_rating_stats`
  - `user_favorites`
  - คอลัมน์ `phone`, `website`, `suggested_duration_min`, `best_for` ใน `bangkok_unseen`
  - ทุกตารางเปิด RLS และมี policy แล้ว
- แก้ syntax error ใน `core_tables.sql`

### Backend (`apps/server`)
- `lib/place-data.ts`: ตัวช่วยกลาง ได้แก่
  - `PLACE_COLUMNS` (ไม่ดึงคอลัมน์ embedding)
  - กันอักขระพิเศษใน search filter (กัน PostgREST filter injection)
  - ค้นหาได้ทั้งไทยและอังกฤษ
  - แปลง category ของ UI เป็น tag จริง
  - rating stats และการหาสถานที่จาก slug
  - ข้อความสำหรับสร้าง embedding
- `/api/places`:
  - กรองเฉพาะสถานที่ที่เผยแพร่แล้ว
  - รับ parameter ได้ทั้ง `query`/`categories` และ `search`/`tag`
  - ส่งคะแนนรีวิวมาด้วย
  - เพิ่ม endpoint รีวิว `GET/PUT/DELETE /api/places/:slug/reviews`
  - สถานที่ใกล้เคียงเรียงตามระยะทาง
- `/api/favorites`: `GET`, `PUT /:placeId`, `DELETE /:placeId`
- Admin:
  - รับฟิลด์ใหม่และเวลาเปิด-ปิด
  - แก้ `is_published` ได้
  - รายการไม่ดึง vector embedding มาแล้ว และส่ง `has_embedding` แทน
  - จำนวนทั้งหมดคิดตามคำค้น
- Agent:
  - แสดง error จริงแทนการจบด้วย `done: ok` เปล่าๆ
  - ลด `maxRetries` เหลือ 2 เมื่อ OpenAI error จะตอบภายในประมาณ 9 วินาที จากเดิม 100–200 วินาที
- สคริปต์ `bun run db:embed` (`src/scripts/backfill-embeddings.ts`)
- โปรไฟล์: ลบรูป, ล้างปีเกิด/สไตล์ และใส่งบ 0 ได้ และ error validation อ่านเข้าใจได้

### Frontend (`apps/web`)
- **บั๊กที่แก้:**
  - hook ของ `/map` crash
  - ช่องค้นหาบนแผนที่ไม่ทำงาน
  - `?place=` และ `?chat=` ใน URL ไม่ถูกอ่าน
  - ปุ่มหน้าแรกไม่ลิงก์ไปไหน
  - header พิมพ์ข้อมูล user ลง console
  - ช่อง Address ในหน้า admin ไม่ถูกบันทึก
  - ปุ่ม Share ในหน้ารายละเอียดทริปเป็นของปลอม
  - การอัปโหลดรูปโปรไฟล์ลบไฟล์เก่าก่อนที่ผู้ใช้จะกด Save
- **เอาข้อมูลปลอมออก:**
  - rating และจำนวนรีวิวที่สุ่ม
  - เวลาเปิด-ปิดตายตัว
  - เบอร์โทร `xxx`
  - "1-2 hours" และ "All ages"
  - ปุ่ม favorite ที่จำค่าไว้แค่ในหน้า
- **Redesign ทุกหน้า** สไตล์ warm editorial (สีครีม / teal `#0E5A5F` / saffron `#E3A72F` · ฟอนต์ Fraunces + Noto Serif Thai + IBM Plex Sans Thai)
  - หน้าหลัก: home, places, place detail, header
  - หน้าบัญชี: auth, profile, onboarding, saved trips list และ detail, admin
  - แผนที่: ใช้ codemod แปลงสีเป็นค่าสีกลาง และเปลี่ยนสไตล์แผนที่เป็น light
- **คำแปลไทย/อังกฤษ:** home, places, placeDetail, auth, onboarding, profile และ savedTrips
- **เทสต์:** เพิ่ม `lib/__tests__/opening-hours.test.ts`
- **design system:** `design-system/seeu-bangkok/MASTER.md`

## 3. สิ่งที่ยังไม่ได้ทำ / ต้องทำต่อ

| # | งาน | ประเภท | สถานะ |
|---|---|---|---|
| 1 | เติมเครดิต OpenAI แล้วรัน `bun run db:embed` เพื่อให้ AI search และ chat ใช้งานได้ | ปฏิบัติการ (ผู้ใช้ทำเอง) | ติดเรื่องเครดิต |
| 2 | กรอกเวลาเปิด-ปิด, เบอร์โทร, เว็บไซต์ และเวลาที่แนะนำ ของสถานที่ทั้ง 28 แห่ง ผ่านหน้า admin | เนื้อหา (ผู้ใช้ทำเอง) | ยังว่าง |
| 3 | ทดสอบหน้าที่ต้องล็อกอิน: `/map`, `/profile`, `/onboarding`, `/saved-trips/[id]`, `/admin/*` | QA | ยังไม่ได้ทดสอบในเบราว์เซอร์ |
| 4 | ทำให้ไฟล์ `.md` ใน `docs/` และ `design-system/` ถูก commit ได้ (ตอนนี้ `.gitignore` ignore `*.md` ทั้งหมด) | config | Task 1 ในแผน |
| 5 | เขียน unit test ให้ helper ใน `lib/place-data.ts` | test | Task 2 |
| 6 | สถานะ "เปิดอยู่/ปิดอยู่" ใช้เวลาของเครื่องผู้ใช้ ต้องคำนวณตามเวลา Asia/Bangkok | bug | Task 3 |
| 7 | `AuthButton` ดึงข้อมูลโปรไฟล์ทุก 5 วินาที ควรอ่านจาก context แทน | perf | Task 4 |
| 8 | ลบรูปโปรไฟล์เก่าออกจาก storage หลังบันทึกโปรไฟล์สำเร็จ (ตอนนี้ไฟล์ค้าง) | cleanup | Task 5 |
| 9 | แปลข้อความที่ยังเป็นภาษาอังกฤษ: admin, dialog ทริป, popup บนแผนที่, คำแนะนำในแชท, image-upload | i18n | Task 6 |
| 10 | `/chat` เป็นหน้าทดสอบสำหรับนักพัฒนา ควรซ่อนใน production | security / UX | Task 7 |
| 11 | ย้ายรูปสถานที่ที่ hotlink จาก 18 เว็บไซต์ไปเก็บใน Supabase Storage (ต้องตรวจสอบสิทธิ์ใช้รูปก่อน) | data / infra | Task 8 |
| 12 | Supabase advisor: `update_updated_at_column` ยังไม่ได้ตั้ง `search_path`, extension `vector` อยู่ใน schema `public`, และยังไม่ได้เปิด leaked password protection | security | Task 9 (ส่วน SQL) และ dashboard (ผู้ใช้ทำเอง) |

แผนงานละเอียด: `docs/superpowers/plans/2026-10-28-seeu-bkk-next-steps.md`
Prompt สำหรับเริ่ม session ใหม่: `docs/superpowers/plans/2026-10-28-handoff-prompt.md`

## 4. วิธีรันบน localhost

```bash
bun install
bun run dev            # server :3000 + web :3001
cd apps/server && bun test
cd apps/web && bun test && bunx tsc --noEmit
```
