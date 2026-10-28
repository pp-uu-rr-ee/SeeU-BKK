# Prompt สำหรับเริ่ม session ใหม่

ก๊อปข้อความในกรอบด้านล่างไปวางในหน้าต่าง Claude Code ใหม่ที่เปิดโฟลเดอร์ `SeeU-BKK`

```text
โปรเจกต์นี้คือ SeeU Bangkok: เว็บช่วยเที่ยวเมืองเก่ากรุงเทพฯ สองภาษา
- monorepo แบบ Bun + Turborepo
- apps/server: Hono API (port 3000)
- apps/web: Next.js 16 (port 3001)
- ใช้ Supabase project ihdcpucmdyprgbykbuvs, OpenAI และ Mapbox

ก่อนเริ่มงาน อ่าน 3 ไฟล์นี้ให้ครบ:
1. docs/PROJECT_STATUS.md: สรุปว่าทำอะไรไปแล้ว และยังเหลืออะไร
2. docs/superpowers/plans/2026-10-28-seeu-bkk-next-steps.md: แผนงาน 10 tasks
3. design-system/seeu-bangkok/MASTER.md: กฎด้านดีไซน์ (ใช้ token สี, ฟอนต์ และ pattern ของหน้า)

งานที่ต้องทำ:
ใช้ skill superpowers:executing-plans ทำแผนข้างต้นทีละ task ตามลำดับ Task 1 → Task 10
- ทำตาม step ในแผนตรงๆ: เขียนเทสต์ให้ fail ก่อน → implement → รันเทสต์และ typecheck ให้ผ่าน → commit
- ข้อความ commit ต้องลงท้ายด้วย Co-Authored-By ตามที่ Global Constraints ระบุ

กติกา:
- ใช้ bun เท่านั้น ห้ามใช้ npm install
- ถ้าต้องแก้ schema ของฐานข้อมูล ให้เขียนไฟล์ SQL ไว้ใน apps/server/sql/ และ apply ผ่าน Supabase MCP (apply_migration) เพิ่มของใหม่ได้อย่างเดียว ห้ามลบข้อมูล
- ข้อความ UI ทุกจุดต้องมีทั้งใน en.json และ th.json
- Task 8 (ย้ายรูปสถานที่ไป Supabase Storage): รันได้แค่ --dry-run แล้วหยุดถามผมก่อน ห้ามอัปโหลดจริงจนกว่าผมจะยืนยันสิทธิ์ใช้รูป
- Task 10 (QA หน้าที่ต้องล็อกอิน): ผมจะล็อกอินเอง ห้ามพิมพ์รหัสผ่าน ถ้าล็อกอินไม่ได้ ให้เขียน checklist ไว้ให้ผมทดสอบเองแทน
- งานใน "Human prerequisites" (เติมเครดิต OpenAI, กรอกข้อมูลสถานที่, เปิด leaked password protection) เป็นงานของผม ไม่ต้องทำ
- ถ้า step ไหนไม่ชัด หรือโค้ดจริงไม่ตรงกับที่แผนบอก (เช่น บรรทัดย้ายที่ หรือชื่อฟังก์ชันต่างไป) ให้หยุดถามก่อน อย่าเดาเอง
- จบแต่ละ task ให้สรุปสั้นๆ ว่าทำอะไรไปแล้ว เทสต์ผ่านกี่ตัว และ commit hash

เริ่มจาก Task 1 ได้เลย
```

## ตัวเลือกเพิ่มเติม

- **ใช้ subagent แยกทำแต่ละ task (ช้ากว่าแต่มีการ review ทุก task):** เปลี่ยนบรรทัด "ใช้ skill superpowers:executing-plans" เป็น "ใช้ skill superpowers:subagent-driven-development"
- **ทำแค่บาง task:** เปลี่ยน "Task 1 → Task 10" เป็นเลข task ที่ต้องการ เช่น "ทำเฉพาะ Task 3, 4 และ 5" ทุก task ทำแยกกันได้ ยกเว้น Task 1 ที่ควรทำก่อน เพื่อให้ไฟล์ในโฟลเดอร์ docs ถูก commit ได้
