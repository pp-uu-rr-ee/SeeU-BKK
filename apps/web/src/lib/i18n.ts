import en from "../locales/en.json";
import th from "../locales/th.json";

export type Locale = "en" | "th";

const translations: Record<Locale, Record<string, any>> = { en, th };

/** Looks up `key` (dot path) for a given locale and fills {placeholder} tokens. */
export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string> | string,
  fallback?: string
): string {
  // Support legacy call: t(key, fallbackString)
  const resolvedFallback = typeof vars === "string" ? vars : (fallback ?? "");
  const resolvedVars = typeof vars === "object" ? vars : undefined;

  let value: any = translations[locale];
  for (const part of key.split(".")) {
    if (value && typeof value === "object" && part in value) {
      value = value[part];
    } else {
      return resolvedFallback || key;
    }
  }
  if (typeof value !== "string") return resolvedFallback || key;

  if (resolvedVars) {
    return value.replace(/\{(\w+)\}/g, (_: string, k: string) => resolvedVars[k] ?? `{${k}}`);
  }
  return value;
}
