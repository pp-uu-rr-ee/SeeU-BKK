import { translate, type Locale } from "./i18n";

export interface LocalizablePlace {
  name: string;
  description?: string | null;
  name_th?: string | null;
  description_th?: string | null;
}

/** Display name/description for the current language; Thai falls back to English when missing. */
export function localizedPlace(place: LocalizablePlace, locale: Locale): { name: string; description: string } {
  const pick = (thai: string | null | undefined, english: string | null | undefined) =>
    (locale === "th" && thai?.trim()) || english || "";
  return {
    name: pick(place.name_th, place.name),
    description: pick(place.description_th, place.description),
  };
}

/** Readable label for a place tag in the current language ("walking-street" → "Walking street" / "ถนนคนเดิน"). */
export function tagLabel(tag: string, locale: Locale): string {
  const key = tag.trim().toLowerCase().replace(/[\s_]+/g, "-");
  const label = translate(locale, `tags.${key}`);
  if (label !== `tags.${key}`) return label;
  const words = key.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
