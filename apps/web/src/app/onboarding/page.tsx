'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth, type OnboardingPreferences } from '@/contexts/auth-context'
import { useTranslation } from '@/contexts/language-context'
import { cn } from '@/lib/utils'

// Stored ids/values stay stable; labels come from locales (onboarding.*)
const vibeCards = [
  { id: 'v1', img: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=800&auto=format&fit=crop' },
  { id: 'v2', img: 'https://images.unsplash.com/photo-1555899434-94d1368aa7af?q=80&w=800&auto=format&fit=crop' },
  { id: 'v3', img: 'https://images.unsplash.com/photo-1528181304800-259b08848526?q=80&w=800&auto=format&fit=crop' },
  { id: 'v4', img: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=800&auto=format&fit=crop' },
  { id: 'v5', img: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=800&auto=format&fit=crop' },
  { id: 'v6', img: 'https://images.unsplash.com/photo-1582293041079-7814c2f12063?q=80&w=800&auto=format&fit=crop' },
]

const travelStyles = ['flaneur', 'archivist', 'epicurean', 'synthesizer']

const preferences = {
  transit: ['Public Rail / BTS', 'Pedestrian Routes', 'Private Rides (Grab)', 'River Ferries', 'Motorcycle Taxis'],
  culinary: ['Street Carts', 'Historic Shophouses', 'Specialty Cafes', 'Mid-tier Local', 'Omakase / Fine Dining'],
  boundaries: ['Tourist Traps', 'High-Density Crowds', 'Chain Establishments', 'Intense Humidity Walks', 'Loud Nightclubs', 'Early Morning Starts'],
}

const totalSteps = 4

function Chip({
  active,
  tone = 'primary',
  onClick,
  children,
}: {
  active: boolean
  tone?: 'primary' | 'avoid'
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors',
        active
          ? tone === 'avoid'
            ? 'border-destructive/40 bg-destructive/10 text-destructive'
            : 'border-primary bg-teal-soft text-primary'
          : 'border-border bg-card text-foreground hover:border-primary/40'
      )}
    >
      {active && <Check className="h-4 w-4" aria-hidden />}
      {children}
    </button>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { user, loading: authLoading, saveOnboarding } = useAuth()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [selections, setSelections] = useState<OnboardingPreferences>({
    vibes: [],
    travelStyle: '',
    pace: 50,
    transit: [],
    culinary: [],
    boundaries: [],
  })

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth/login')
    }
  }, [authLoading, user, router])

  const toggleArrayItem = (key: 'vibes' | 'transit' | 'culinary' | 'boundaries', value: string) => {
    setSelections((prev) => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter((item) => item !== value) : [...prev[key], value],
    }))
  }

  const submit = async (skipped: boolean) => {
    setSubmitting(true)
    const { error } = await saveOnboarding(selections, { skipped })
    setSubmitting(false)

    if (error) {
      toast.error(error)
      return
    }

    toast.success(skipped ? t('onboarding.skipped') : t('onboarding.saved'))
    router.push('/')
  }

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-muted-foreground" role="status">
        <Loader2 className="mr-3 h-5 w-5 animate-spin text-primary" aria-hidden />
        {t('onboarding.loading')}
      </div>
    )
  }

  const stepTitle = t(`onboarding.s${step}Title`)
  const stepDesc = t(`onboarding.s${step}Desc`)

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 md:py-14">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-primary">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-saffron" />
            {t('onboarding.eyebrow')}
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl">{t('onboarding.title')}</h1>
        </div>
        <Button variant="ghost" className="h-11 rounded-full text-muted-foreground" onClick={() => submit(true)} disabled={submitting}>
          {t('onboarding.skip')}
        </Button>
      </header>

      {/* Stepper */}
      <ol className="mt-8 grid grid-cols-4 gap-2" aria-label={t('onboarding.stepOf', { step: String(step), total: String(totalSteps) })}>
        {[1, 2, 3, 4].map((n) => (
          <li key={n} aria-current={n === step ? 'step' : undefined}>
            <div className={cn('h-1.5 rounded-full', n <= step ? 'bg-primary' : 'bg-secondary')} />
            <p className={cn('mt-2 hidden text-xs sm:block', n === step ? 'font-medium text-foreground' : 'text-muted-foreground')}>
              {n}. {t(`onboarding.steps.${n - 1}`)}
            </p>
          </li>
        ))}
      </ol>

      <section className="mt-10" aria-labelledby="step-title">
        <p className="text-sm text-muted-foreground">{t('onboarding.stepOf', { step: String(step), total: String(totalSteps) })}</p>
        <h2 id="step-title" className="mt-1 font-display text-2xl font-semibold text-foreground md:text-3xl">{stepTitle}</h2>
        <p className="mt-2 text-muted-foreground">{stepDesc}</p>

        <div className="mt-8">
          {step === 1 && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {vibeCards.map((card) => {
                const selected = selections.vibes.includes(card.id)
                return (
                  <button
                    key={card.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleArrayItem('vibes', card.id)}
                    className={cn(
                      'group relative aspect-[4/3] overflow-hidden rounded-2xl bg-teal-soft text-left ring-offset-2 ring-offset-background transition',
                      selected ? 'ring-[3px] ring-primary' : 'hover:ring-2 hover:ring-primary/30'
                    )}
                  >
                    <img src={card.img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                    {selected && (
                      <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-4 w-4" aria-hidden />
                      </span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/80">{t(`onboarding.vibes.${card.id}.1`)}</p>
                      <p className="font-display text-lg font-semibold leading-snug text-white">{t(`onboarding.vibes.${card.id}.0`)}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4 md:grid-cols-2" role="radiogroup" aria-labelledby="step-title">
              {travelStyles.map((id) => {
                const active = selections.travelStyle === id
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSelections((prev) => ({ ...prev, travelStyle: id }))}
                    className={cn(
                      'flex items-start gap-4 rounded-2xl border p-5 text-left transition-colors',
                      active ? 'border-primary bg-teal-soft' : 'border-border bg-card hover:border-primary/40'
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                        active ? 'border-primary' : 'border-input'
                      )}
                    >
                      {active && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                    </span>
                    <span>
                      <span className="block font-display text-xl font-semibold text-foreground">{t(`onboarding.styles.${id}.0`)}</span>
                      <span className="mt-1 block text-muted-foreground">{t(`onboarding.styles.${id}.1`)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-10">
              <div className="rounded-2xl border border-border bg-card p-6">
                <label htmlFor="pace" className="text-sm font-medium text-foreground">{t('onboarding.paceLabel')}</label>
                <input
                  id="pace"
                  type="range"
                  min={0}
                  max={100}
                  step={10}
                  value={selections.pace}
                  onChange={(e) => setSelections((prev) => ({ ...prev, pace: Number(e.target.value) }))}
                  className="mt-5 h-2 w-full cursor-pointer accent-[var(--primary)]"
                  aria-valuetext={`${selections.pace}%`}
                />
                <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                  <span>{t('onboarding.paceSlow')}</span>
                  <span className="font-display text-xl font-semibold text-primary">{selections.pace}%</span>
                  <span>{t('onboarding.paceFast')}</span>
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-medium text-foreground">{t('onboarding.transitTitle')}</h3>
                <div className="flex flex-wrap gap-2">
                  {preferences.transit.map((item) => (
                    <Chip key={item} active={selections.transit.includes(item)} onClick={() => toggleArrayItem('transit', item)}>
                      {t(`onboarding.transit.${item}`)}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-10 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-sm font-medium text-foreground">{t('onboarding.culinaryTitle')}</h3>
                <div className="flex flex-wrap gap-2">
                  {preferences.culinary.map((item) => (
                    <Chip key={item} active={selections.culinary.includes(item)} onClick={() => toggleArrayItem('culinary', item)}>
                      {t(`onboarding.culinary.${item}`)}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-medium text-foreground">{t('onboarding.avoidTitle')}</h3>
                <div className="flex flex-wrap gap-2">
                  {preferences.boundaries.map((item) => (
                    <Chip key={item} tone="avoid" active={selections.boundaries.includes(item)} onClick={() => toggleArrayItem('boundaries', item)}>
                      {t(`onboarding.boundaries.${item}`)}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="mt-12 flex items-center justify-between gap-4 border-t border-border pt-6">
        <Button
          variant="ghost"
          className="h-12 rounded-full px-5"
          disabled={step === 1}
          onClick={() => setStep((prev) => Math.max(1, prev - 1))}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> {t('onboarding.back')}
        </Button>
        {step < totalSteps ? (
          <Button className="h-12 rounded-full px-7 text-base" onClick={() => setStep((prev) => Math.min(totalSteps, prev + 1))} disabled={submitting}>
            {t('onboarding.next')} <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <Button className="h-12 rounded-full px-7 text-base" onClick={() => submit(false)} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {t('onboarding.finish')}
          </Button>
        )}
      </div>
    </div>
  )
}
