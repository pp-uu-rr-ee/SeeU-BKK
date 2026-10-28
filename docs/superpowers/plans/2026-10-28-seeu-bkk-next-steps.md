# SeeU Bangkok — Next Steps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining correctness, performance, i18n, data-hosting and security gaps listed in the project status so the app is ready for real users.

**Architecture:** Bun/Turborepo monorepo. `apps/server` is a Hono API on Bun that talks to Supabase with the service-role key; `apps/web` is a Next.js 16 App Router client app that calls the API with the user's Supabase JWT. Pure logic goes in small `lib/` modules with `bun:test` tests next to them in `__tests__/`; I/O stays in routers and scripts.

**Tech Stack:** Bun 1.2, TypeScript 5, Hono 4, Zod 4, Supabase JS 2 (Postgres + pgvector + Storage), Next.js 16, React 19, Tailwind CSS 4.

**Spec:** `docs/PROJECT_STATUS.md` (section 3 is the backlog this plan implements)

## Global Constraints

- Package manager is Bun: `bun install`, `bun test`, `bunx tsc --noEmit`. Never `npm install` (it rewrites `package-lock.json`).
- Supabase project id `ihdcpucmdyprgbykbuvs`. Every schema change ships as a file in `apps/server/sql/` **and** is applied with the Supabase MCP `apply_migration`. Additive changes only — no `DROP` of user data.
- UI strings live in `apps/web/src/locales/en.json` and `th.json`; read them with `useTranslation().t('section.key')`. Both files must have identical key sets.
- Design tokens only (see `design-system/seeu-bangkok/MASTER.md`): `primary`, `teal-soft`, `saffron`, `muted-foreground`, `destructive`, `border`. No raw `blue-*`/`gray-*` classes.
- Bangkok time is `Asia/Bangkok` (UTC+7, no DST).
- Public avatar bucket is `user-uploads`, objects under `avatars/`. Public URL prefix: `/storage/v1/object/public/user-uploads/`.
- Every task ends green on: `cd apps/server && bun test && bunx tsc --noEmit -p .` and `cd apps/web && bun test && bunx tsc --noEmit`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Human prerequisites (not agent tasks)

- Top up OpenAI credits, then `cd apps/server && bun run db:embed` (fills `bangkok_unseen.embedding` for all 28 places).
- Enter opening hours / phone / website / suggested duration for each place via `/admin/places/:id/edit` (no verified source data exists; do not invent it).
- Supabase dashboard → Auth → enable *Leaked password protection*.

## Review Focus

- A visitor outside Thailand (browser TZ ≠ Asia/Bangkok) sees "Open now" for a place that is closed in Bangkok — Task 3 pins this with UTC-built dates.
- A search term containing `,`, `(`, `)`, `%`, `"` or only punctuation must not break or widen the PostgREST filter — Task 2 pins `sanitizeSearchTerm`/`placeSearchFilter` with these inputs.
- Saving a profile whose old avatar is an external URL (not in our bucket) or is unchanged must never delete anything — Task 5 pins `avatarStoragePath` and the "same URL" case.
- A Thai-locale user meets English text in dialogs/admin, or a key missing in one locale renders the raw key — Task 6's locale-parity test fails on any missing key.
- An image URL that 404s, times out, or returns HTML instead of an image during migration must leave that row untouched and be reported — Task 8 pins `imageExtensionFor` returning `null` for non-image types and the script's skip path.

---

### Task 1: Track docs and design-system Markdown in git

**Files:**
- Modify: `.gitignore` (the `*.md` rule at line 12)

- [ ] **Step 1: Add negations directly below `*.md`**

```gitignore
!docs/**/*.md
!design-system/**/*.md
```

- [ ] **Step 2: Verify nothing under those folders is ignored**

Run: `git check-ignore -v docs/PROJECT_STATUS.md design-system/seeu-bangkok/MASTER.md; echo "exit $?"`
Expected: no output lines, `exit 1`

- [ ] **Step 3: Commit**

```bash
git add .gitignore docs design-system
git commit -m "chore: track project docs and design system"
```

---

### Task 2: Extract and test pure place-search helpers

`apps/server/src/lib/place-data.ts` imports the Supabase client, so its pure helpers can't be tested without env vars. Move them into a dependency-free module.

**Files:**
- Create: `apps/server/src/lib/place-search.ts`
- Modify: `apps/server/src/lib/place-data.ts` (delete the moved functions, add `export { sanitizeSearchTerm, placeSearchFilter, categoriesToTags, buildPlaceEmbeddingText } from './place-search'`)
- Test: `apps/server/src/lib/__tests__/place-search.test.ts`

**Interfaces:**
- Produces (unchanged signatures, now in `place-search.ts`):
  - `sanitizeSearchTerm(term: string): string`
  - `placeSearchFilter(term: string): string | null`
  - `categoriesToTags(categories: string | string[] | undefined): string[]`
  - `buildPlaceEmbeddingText(place: { name: string; area?: string | null; description?: string | null; name_th?: string | null; description_th?: string | null; tags?: string[] | null; address?: string | null; price?: number | null }): string`
- Existing importers (`routers/places.ts`, `routers/admin.ts`, `lib/tools.ts`, `scripts/backfill-embeddings.ts`) keep importing from `place-data` and need no change.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from "bun:test";
import { buildPlaceEmbeddingText, categoriesToTags, placeSearchFilter, sanitizeSearchTerm } from "../place-search";

describe("sanitizeSearchTerm", () => {
  test("strips PostgREST filter syntax", () => {
    expect(sanitizeSearchTerm('a),id.eq.(x')).toBe("a id.eq. x");
    expect(sanitizeSearchTerm('wat "pho", 100%')).toBe("wat pho 100");
  });
  test("keeps Thai text", () => {
    expect(sanitizeSearchTerm("  วัด  โพธิ์ ")).toBe("วัด โพธิ์");
  });
});

describe("placeSearchFilter", () => {
  test("ORs name/description in both languages", () => {
    expect(placeSearchFilter("wat")).toBe(
      "name.ilike.%wat%,description.ilike.%wat%,name_th.ilike.%wat%,description_th.ilike.%wat%"
    );
  });
  test("returns null when nothing searchable remains", () => {
    expect(placeSearchFilter(",(%)")).toBeNull();
  });
});

describe("categoriesToTags", () => {
  test("maps UI categories to stored tags and dedupes", () => {
    expect(categoriesToTags("restaurant,temple")).toEqual(["food", "restaurant", "temple"]);
    expect(categoriesToTags(["all", "", "Shopping"])).toEqual(["market", "mall", "walking-street", "shopping"]);
  });
  test("handles undefined", () => {
    expect(categoriesToTags(undefined)).toEqual([]);
  });
});

describe("buildPlaceEmbeddingText", () => {
  test("includes Thai fields only when present", () => {
    const text = buildPlaceEmbeddingText({ name: "Wat Pho", name_th: "วัดโพธิ์", tags: ["temple"], price: 300 });
    expect(text).toContain("Thai name: วัดโพธิ์");
    expect(text).toContain("Price: 300 Baht");
    expect(buildPlaceEmbeddingText({ name: "Sanam Luang" })).not.toContain("Thai name");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/server && bun test src/lib/__tests__/place-search.test.ts`
Expected: FAIL — `Cannot find module '../place-search'`

- [ ] **Step 3: Move the four functions and `CATEGORY_TAG_ALIASES` into `place-search.ts`; re-export from `place-data.ts`**

- [ ] **Step 4: Run tests and typecheck**

Run: `cd apps/server && bun test && bunx tsc --noEmit -p .`
Expected: all pass, `tsc` exit 0

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib
git commit -m "test: cover place search helpers in a dependency-free module"
```

---

### Task 3: "Open now" in Bangkok time

`isOpenAt` and the detail page's `today` use the browser's local clock.

**Files:**
- Modify: `apps/web/src/lib/opening-hours.ts`
- Modify: `apps/web/src/app/places/[id]/page.tsx:399` (`const today = new Date().getDay();`)
- Test: `apps/web/src/lib/__tests__/opening-hours.test.ts`

**Interfaces:**
- Produces: `bangkokClock(now: Date): { day: number; minutes: number }` (day 0 = Sunday, minutes since Bangkok midnight). `isOpenAt(hours: OpeningHour[], now: Date): boolean | null` keeps its signature but reads the clock through `bangkokClock`.

- [ ] **Step 1: Import `bangkokClock` alongside `isOpenAt`, rewrite the test file's `at()` helper to build UTC instants, and add a TZ-independence test**

```ts
// Bangkok is UTC+7. 2026-10-26 is a Monday in Bangkok.
const at = (day: number, time: string) => {
  const [h, m] = time.split(":").map(Number);
  return new Date(Date.UTC(2026, 9, 25 + day, h - 7, m));
};

test("bangkokClock ignores the machine timezone", () => {
  expect(bangkokClock(new Date("2026-10-26T02:30:00Z"))).toEqual({ day: 1, minutes: 9 * 60 + 30 });
  expect(bangkokClock(new Date("2026-10-25T20:00:00Z"))).toEqual({ day: 1, minutes: 3 * 60 }); // Sun 20:00 UTC = Mon 03:00 BKK
});
```

Keep the existing `describe("isOpenAt")` cases unchanged; they now run through `at()`.

- [ ] **Step 2: Run under a far-away timezone to verify it fails**

Run: `cd apps/web && TZ=America/Los_Angeles bun test src/lib/__tests__/opening-hours.test.ts`
Expected: FAIL — `bangkokClock` is not exported

- [ ] **Step 3: Implement `bangkokClock` with `Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)`; use it inside `isOpenAt`; in the detail page replace `new Date().getDay()` with `bangkokClock(new Date()).day`**

- [ ] **Step 4: Run in two timezones**

Run: `cd apps/web && TZ=America/Los_Angeles bun test && TZ=Asia/Bangkok bun test && bunx tsc --noEmit`
Expected: all pass both times, `tsc` exit 0

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib apps/web/src/app/places
git commit -m "fix: compute open-now and today in Bangkok time"
```

---

### Task 4: Stop polling the profile every 5 seconds

`apps/web/src/components/auth/auth-button.tsx:41-44` calls `getProfile()` on a 5 s interval plus on window focus. The context already caches the profile (`profileCache`) and `updateProfile` refreshes it.

**Files:**
- Modify: `apps/web/src/contexts/auth-context.tsx` (add `profile` to `AuthContextType` and to the provider `value`)
- Modify: `apps/web/src/components/auth/auth-button.tsx` (read `profile` from `useAuth()`; delete the local `profile` state and all three effects)

**Interfaces:**
- Produces: `useAuth().profile: UserProfile | null` — equals `profileCache`; loaded once after sign-in (call `getProfile()` in the provider when `user` becomes non-null and the cache is empty), replaced by `updateProfile`/`refreshProfile`, cleared on sign-out.

- [ ] **Step 1: Implement the context field and the one-time load**

- [ ] **Step 2: Switch `AuthButton` to `profile` from context**

- [ ] **Step 3: Verify no polling remains**

Run: `cd apps/web && grep -n "setInterval" src/components/auth/auth-button.tsx; bunx tsc --noEmit`
Expected: grep prints nothing; `tsc` exit 0

- [ ] **Step 4: Manual check (signed in)** — open DevTools → Network, stay on `/` for 30 s: zero requests to `/api/auth/me`. Change the avatar on `/profile` and save: the header avatar updates without reload.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/contexts/auth-context.tsx apps/web/src/components/auth/auth-button.tsx
git commit -m "perf: read profile from auth context instead of polling"
```

---

### Task 5: Delete the replaced avatar after a successful profile save

The upload component no longer deletes files (correct: the saved profile may still point at them). Cleanup belongs on the server, after the new URL is persisted.

**Files:**
- Create: `apps/server/src/lib/storage-paths.ts`
- Modify: `apps/server/src/routers/auth.ts` (`auth.put('/profile', ...)`)
- Test: `apps/server/src/lib/__tests__/storage-paths.test.ts`

**Interfaces:**
- Produces: `avatarStoragePath(url: string | null | undefined): string | null` — returns the object path inside `user-uploads` (e.g. `avatars/abc_123.png`) only when the URL contains `/storage/v1/object/public/user-uploads/avatars/`; otherwise `null`.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "bun:test";
import { avatarStoragePath } from "../storage-paths";

const base = "https://ihdcpucmdyprgbykbuvs.supabase.co/storage/v1/object/public/user-uploads/";
test("extracts our avatar object path", () => {
  expect(avatarStoragePath(base + "avatars/x_1.png")).toBe("avatars/x_1.png");
});
test("ignores external, non-avatar and empty URLs", () => {
  expect(avatarStoragePath("https://example.com/a.png")).toBeNull();
  expect(avatarStoragePath(base + "other/x.png")).toBeNull();
  expect(avatarStoragePath("")).toBeNull();
  expect(avatarStoragePath(null)).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/server && bun test src/lib/__tests__/storage-paths.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `avatarStoragePath`; in the profile route, select the current `avatar_url` before the upsert, and after a successful upsert call `supabase.storage.from('user-uploads').remove([path])` when `'avatar_url' in profileData`, the old path is non-null, and the old URL differs from the saved one. Log (don't fail the request) on removal errors.**

- [ ] **Step 4: Run tests and typecheck**

Run: `cd apps/server && bun test && bunx tsc --noEmit -p .`
Expected: all pass, exit 0

- [ ] **Step 5: Manual check (signed in)** — upload a new avatar, save, then in Supabase Storage `user-uploads/avatars/` the previous file is gone and the new one exists.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/lib apps/server/src/routers/auth.ts
git commit -m "fix: remove replaced avatar from storage after profile save"
```

---

### Task 6: Translate the remaining English UI

**Files:**
- Test: `apps/web/src/lib/__tests__/locales.test.ts`
- Modify: `apps/web/src/locales/en.json`, `apps/web/src/locales/th.json` (new sections `admin`, `trips`, `mapPopup`, `imageUpload`; new key `chat.suggestions` as an array of 4)
- Modify: `apps/web/src/app/admin/places/page.tsx`, `apps/web/src/app/admin/places/new/page.tsx`, `apps/web/src/app/admin/places/[id]/edit/page.tsx`, `apps/web/src/components/admin/place-details-fields.tsx`
- Modify: `apps/web/src/components/trips/new-trip-dialog.tsx`, `edit-trip-dialog.tsx`, `add-trip-stop-dialog.tsx`
- Modify: `apps/web/src/components/map/place-popup-content.tsx`, `apps/web/src/components/ui/image-upload.tsx`
- Modify: `apps/web/src/components/planner/chat/constants.ts` (`QUICK_SUGGESTIONS` → read from `chat.suggestions` at the call site in `ChatPanel.tsx`)

- [ ] **Step 1: Write the locale-parity test**

```ts
import { expect, test } from "bun:test";
import en from "../../locales/en.json";
import th from "../../locales/th.json";

const keys = (o: unknown, p = ""): string[] =>
  o && typeof o === "object" && !Array.isArray(o)
    ? Object.entries(o).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k))
    : [p];

test("en and th define the same keys", () => {
  expect(keys(th).sort()).toEqual(keys(en).sort());
});
```

- [ ] **Step 2: Run it** — Run: `cd apps/web && bun test src/lib/__tests__/locales.test.ts`. Expected: PASS today (baseline). It must stay green after every string you add.

- [ ] **Step 3: Replace hard-coded strings in the listed files with `t()` keys; add each key to both locale files.** Toasts, `aria-label`s, placeholders, `confirm()` text and button labels all count. `useTranslation` is a hook — components rendered through `createRoot` (map popups in `map-container.tsx`) receive `t`/`locale` as props instead.

- [ ] **Step 4: Verify** — Run: `cd apps/web && bun test && bunx tsc --noEmit && grep -nE ">[A-Z][a-z]+( [a-z]+)*<|toast\.(success|error)\('[A-Z]" src/components/trips src/app/admin src/components/map/place-popup-content.tsx`. Expected: tests pass, `tsc` 0, grep prints nothing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "i18n: translate admin, trip dialogs, map popup and chat suggestions"
```

---

### Task 7: Hide the developer chat page in production

**Files:**
- Create: `apps/web/src/app/chat/layout.tsx`

- [ ] **Step 1: Implement a server-component layout that calls `notFound()` from `next/navigation` when `process.env.NODE_ENV === 'production'`, otherwise renders `children`.**

- [ ] **Step 2: Verify** — Run: `cd apps/web && bunx next build && (bunx next start -p 3101 & sleep 5; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3101/chat; kill %1)`. Expected: `404`. In `bun run dev`, `/chat` still loads.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/chat/layout.tsx
git commit -m "chore: 404 the dev chat page in production"
```

---

### Task 8: Host place images in Supabase Storage

28 places hotlink images from 18 third-party hosts; several block hotlinking and render as the fallback icon. **Before running the script for real, the project owner must confirm the right to re-host each image** (Wikimedia files need attribution; commercial sites may not allow reuse). The script supports `--dry-run` and `--only <slug>` so the owner can migrate approved images only.

**Files:**
- Create: `apps/server/sql/place_images_bucket.sql` (public bucket `place-images`; `SELECT` policy for `public`; no client write policies — only the service role writes)
- Create: `apps/server/src/lib/image-files.ts`
- Create: `apps/server/src/scripts/migrate-place-images.ts`
- Modify: `apps/server/package.json` (script `"db:images": "bun run src/scripts/migrate-place-images.ts"`)
- Test: `apps/server/src/lib/__tests__/image-files.test.ts`

**Interfaces:**
- Produces: `imageExtensionFor(contentType: string | null): 'jpg' | 'png' | 'webp' | 'gif' | null` (strips `; charset=...`, maps `image/jpeg`→`jpg`; anything else → `null`) and `placeImagePath(slug: string, ext: string): string` → `` `places/${slug}.${ext}` ``.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "bun:test";
import { imageExtensionFor, placeImagePath } from "../image-files";

test("maps image content types", () => {
  expect(imageExtensionFor("image/jpeg")).toBe("jpg");
  expect(imageExtensionFor("image/webp; charset=binary")).toBe("webp");
});
test("rejects non-images", () => {
  expect(imageExtensionFor("text/html; charset=utf-8")).toBeNull();
  expect(imageExtensionFor(null)).toBeNull();
});
test("builds the object path", () => {
  expect(placeImagePath("wat-pho", "jpg")).toBe("places/wat-pho.jpg");
});
```

- [ ] **Step 2: Run to verify it fails** — Run: `cd apps/server && bun test src/lib/__tests__/image-files.test.ts`. Expected: FAIL — module not found.

- [ ] **Step 3: Implement `image-files.ts`; apply the bucket SQL with `apply_migration` (name `place_images_bucket`); implement the script:** select `id, slug, image_url` from `bangkok_unseen` where `image_url` does not contain `.supabase.co/storage/`; for each, `fetch` with a 15 s `AbortSignal.timeout` and a browser-like `User-Agent`; skip and report when `!res.ok` or `imageExtensionFor` is `null`; upload to `place-images` at `placeImagePath` with `upsert: true`; update `image_url` to the public URL. `--dry-run` prints the plan without uploading or updating. Print a final `migrated / skipped` summary.

- [ ] **Step 4: Verify** — Run: `cd apps/server && bun test && bunx tsc --noEmit -p . && bun run db:images --dry-run`. Expected: tests pass; dry run lists 28 rows with planned paths and changes nothing (re-run `curl -s localhost:3000/api/places?limit=1` shows the old URL).

- [ ] **Step 5: Commit**

```bash
git add apps/server/sql/place_images_bucket.sql apps/server/src apps/server/package.json
git commit -m "feat: script to re-host place images in Supabase Storage"
```

---

### Task 9: Database security hardening

**Files:**
- Create: `apps/server/sql/security_hardening.sql`

- [ ] **Step 1: Write the migration** — `ALTER FUNCTION public.update_updated_at_column() SET search_path = public;`. Do **not** move the `vector` extension out of `public`: `bangkok_unseen.embedding` and `match_places` depend on it; record that decision as a SQL comment.

- [ ] **Step 2: Apply** with the Supabase MCP `apply_migration` (name `security_hardening`).

- [ ] **Step 3: Verify** with `get_advisors` (type `security`). Expected: no `function_search_path_mutable` finding. Remaining: `extension_in_public` (accepted, documented), `rls_enabled_no_policy` on `bangkok_unseen` (accepted: only the service role reads it), leaked-password protection (human prerequisite).

- [ ] **Step 4: Commit**

```bash
git add apps/server/sql/security_hardening.sql
git commit -m "chore(db): pin search_path on updated_at trigger function"
```

---

### Task 10: Signed-in QA pass

No code unless a check fails; a failure becomes its own fix commit with a regression test where the logic is testable.

- [ ] **Step 1:** Sign in at `http://localhost:3001/auth/login` with the owner's account (the owner signs in; agents never type real passwords).
- [ ] **Step 2: `/map`** — map uses the light style; category chips filter results; `/map?place=wat-pho` selects Wat Pho; `/map?chat=true&about=Wat%20Pho` opens chat with the question prefilled and not sent.
- [ ] **Step 3: `/places/wat-pho`** — Save toggles the heart and appears under *Favorite places* on `/saved-trips`; posting, editing and deleting a review updates the rating in the header.
- [ ] **Step 4: `/profile`** — change photo → "Unsaved changes" → Save → reload keeps it; Remove → Save → reload shows the placeholder; clearing birth year persists.
- [ ] **Step 5: `/onboarding`** — all 4 steps in Thai and English; Save returns to `/` and `/profile` shows the survey as completed.
- [ ] **Step 6: `/saved-trips/<id>`** — static map shows numbered pins; *Open in Google Maps* opens a multi-stop route; Share copies the link.
- [ ] **Step 7: `/admin/places`** (admin role) — table lists 28 rows; *No embedding* badges disappear after the human prerequisite `db:embed`; editing opening hours shows them on the detail page with the correct "Open now".
- [ ] **Step 8:** Repeat Steps 2–4 at 375 px width: no horizontal scroll, all tap targets ≥ 44 px.
