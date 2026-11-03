"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { translate, type Locale } from "@/lib/i18n";

export type { Locale };

interface LanguageContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string> | string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

/** The language the provider settles on after mount: the saved choice, else the browser's. */
export function resolveStoredLocale(): Locale {
  try {
    const v = localStorage.getItem("locale") as Locale | null;
    return v ?? (navigator.language?.startsWith("th") ? "th" : "en");
  } catch (e) {
    return "en";
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(resolveStoredLocale());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("locale", locale);
    } catch (e) {
      // ignore
    }
    // Screen readers and the browser pick pronunciation/hyphenation from <html lang>
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (l: Locale) => setLocaleState(l);

  const t = (key: string, vars?: Record<string, string> | string, fallback?: string) =>
    translate(locale, key, vars, fallback);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

export function useTranslation() {
  const { t, locale, setLocale } = useLanguage();
  return { t, locale, setLocale };
}
