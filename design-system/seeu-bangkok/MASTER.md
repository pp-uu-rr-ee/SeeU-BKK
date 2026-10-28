# SeeU Bangkok — Design System (Master)

Direction: **warm editorial travel magazine**. Photo-led, cream paper background, deep teal as the
brand color, saffron/gold (temple ornament) as the highlight. Serif display headings, clean
Thai-ready sans for everything else. Light theme only.

Source of truth for tokens: `apps/web/src/index.css` (`:root` + `@theme inline`).
Fonts are loaded in `apps/web/src/app/layout.tsx` via `next/font/google`.

## Color tokens

| Token | Value | Use |
|---|---|---|
| `background` | `#FBF7F0` | Page background (cream paper) |
| `foreground` | `#1F1A14` | Body text (warm ink) |
| `card` | `#FFFFFF` | Cards, sheets |
| `primary` | `#0E5A5F` | Brand teal: primary buttons, links, active nav, focus ring |
| `primary-foreground` | `#FFFFFF` | Text on primary (≈ 8:1) |
| `secondary` | `#F1E8D9` | Secondary buttons, chips |
| `muted` / `muted-foreground` | `#F3ECE1` / `#6B5E4F` | Quiet surfaces / secondary text (≈ 5.8:1 on cream) |
| `accent` / `accent-foreground` | `#F6E7C1` / `#5C3D00` | Saffron wash for highlights, selected filters |
| `saffron` | `#E3A72F` | Decorative only: rating stars, rules, eyebrow dots. Never body text on cream |
| `teal-soft` | `#DDEDEC` | Tinted icon tiles, info surfaces |
| `border` | `#E6DCCB` | Hairlines |
| `destructive` | `#B42318` | Errors, delete |

## Typography

| Role | Font | Notes |
|---|---|---|
| Display (`font-display`) | Fraunces → Noto Serif Thai | h1/h2, place names, editorial numbers. Weight 600, tight tracking |
| Body/UI (`font-sans`) | IBM Plex Sans Thai | Covers Thai + Latin. 16px base, line-height 1.6 (Thai needs the extra leading) |

Scale: hero `text-5xl md:text-7xl`, page title `text-4xl md:text-5xl`, section `text-2xl md:text-3xl`,
card title `text-lg`, body `text-base`, meta `text-sm`. Avoid text below 12px.

Eyebrow labels: `text-xs uppercase tracking-[0.18em] text-primary font-medium` with a saffron dot.

## Shape, depth, spacing

- Radius: cards `rounded-2xl`, buttons/inputs `rounded-full` (pill) or `rounded-xl`, images inside cards inherit.
- Shadows are soft and warm: `shadow-[0_1px_2px_rgba(31,26,20,0.06),0_8px_24px_-12px_rgba(31,26,20,0.18)]` (`shadow-card`).
- Hairline borders (`border-border`) over heavy shadows.
- Section rhythm: `py-16 md:py-24`; container `max-w-7xl px-4 sm:px-6`.

## Imagery

- Real place photos from the API (`image_url`), always `object-cover` with a fixed aspect ratio
  (`aspect-[4/3]` cards, `aspect-[3/4]` editorial tiles) to avoid layout shift.
- Text over photos sits on a bottom gradient `from-black/70`; never put text on an un-scrimmed photo.
- Missing image → teal-soft surface with a Lucide `ImageOff`/`Camera` icon, never a stock placeholder URL.

## Interaction

- All clickable cards are real `<Link>`s (keyboard + middle-click work).
- Hover: image `scale-[1.03]` over 500ms, card lift via shadow only; 150–300ms color transitions.
- Visible focus: `focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-background`.
- Touch targets ≥ 44px. Icon-only buttons need `aria-label`.
- Respect `prefers-reduced-motion` (no entrance animations, no parallax).

## Anti-patterns

- Blue/purple gradients and raw `blue-600` classes on redesigned pages — use `primary`.
- Emoji as icons; Lucide only.
- Placeholder data presented as real (ratings, hours, contacts).
- Hotlinking hero images by hard-coded third-party URL.

## Page patterns

- **Page header:** eyebrow (saffron dot + uppercase teal label) → `font-display` h1 → muted subtitle. Used on places, saved trips, profile, onboarding, admin.
- **Auth:** `AuthShell` split layout (teal editorial panel on `lg+`, form column), `AuthHeading`, `PasswordInput` with labelled show/hide. Validation errors render under the field, not only as toasts.
- **Lists of owned items** (saved trips): selectable cards with `aria-pressed` + sticky detail aside with a teal header band.
- **Selections** (styles, transport, filters): pill chips or bordered cards with `aria-pressed` / radio semantics, `bg-teal-soft` + `border-primary` when active; "avoid" choices use `destructive` tint.
- **Admin:** dense table (`thead bg-muted`, row hover `bg-muted/60`), status pills (Published / Draft / No embedding), icon actions with `aria-label`.
- **Maps:** Mapbox `light-v11`; routes/default pins `#0E5A5F`; cluster ramp teal → `#B9770E` → `#B4532A` → `#8E3B1E`. The user-location dot stays blue by convention.
- **Modals:** `bg-foreground/50` scrim, `rounded-2xl` card, `role="dialog" aria-modal="true"`.
