"use client"

import { Check } from 'lucide-react'
import { useTranslation } from '@/contexts/language-context'

/** Split layout for sign-in / sign-up / reset: editorial teal panel + form column */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const points = [t('auth.panelPoint1'), t('auth.panelPoint2'), t('auth.panelPoint3')]

  return (
    <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl lg:grid-cols-2 lg:gap-12 lg:px-6 lg:py-10">
      <aside className="relative hidden overflow-hidden rounded-3xl bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute -right-28 -top-28 h-80 w-80 rounded-full border-[32px] border-saffron/25" />
        <div aria-hidden className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-white/5" />
        <p className="relative inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-teal-soft">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-saffron" />
          {t('auth.panelEyebrow')}
        </p>
        <div className="relative">
          <h2 className="max-w-md font-display text-4xl font-semibold leading-tight tracking-tight">{t('auth.panelTitle')}</h2>
          <ul className="mt-8 space-y-3">
            {points.map((point) => (
              <li key={point} className="flex items-center gap-3 text-primary-foreground/85">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-saffron text-foreground">
                  <Check className="h-4 w-4" aria-hidden />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <div className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  )
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground">{title}</h1>
      {subtitle && <p className="mt-3 text-muted-foreground">{subtitle}</p>}
    </div>
  )
}

/** Shared input styling for the auth forms */
export const authInputClass = 'h-12 rounded-xl border-input bg-card px-4 text-base'
