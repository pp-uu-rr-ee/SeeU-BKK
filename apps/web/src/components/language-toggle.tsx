"use client";

import React from "react";
import { useLanguage, type Locale } from "@/contexts/language-context";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{ value: Locale; label: string; ariaKey: string }> = [
  { value: "en", label: "EN", ariaKey: "nav.switchToEnglish" },
  { value: "th", label: "ไทย", ariaKey: "nav.switchToThai" },
];

export default function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div
      role="group"
      aria-label={t("nav.language")}
      className={cn("flex items-center rounded-full border border-border bg-card p-0.5", className)}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-label={t(option.ariaKey)}
          aria-pressed={locale === option.value}
          className={cn(
            "h-9 min-w-11 rounded-full px-3 text-sm font-medium transition-colors duration-200",
            locale === option.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setLocale(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
