'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ImageUpload } from '@/components/ui/image-upload'
import { Save, Loader2, Footprints, Bike, Bus, Car, Check, X, Plus, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/contexts/language-context'

interface UserProfile {
  user_id: string
  nick_name: string
  avatar_url?: string
  birth_year?: number
  travel_style?: string[]
  mobility?: 'walk' | 'bike' | 'public' | 'grab'
  budget_per_day?: number
  languages?: string[]
  onboarding_completed?: boolean
  onboarding_completed_at?: string
  onboarding_skipped_at?: string
  onboarding_preferences?: Record<string, any>
  updated_at: string
}

export default function ProfilePage() {
  const { t } = useTranslation()
  const { user, getProfile, updateProfile, refreshProfile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    nick_name: '',
    avatar_url: '',
    birth_year: undefined as number | undefined,
    travel_style: [] as string[],
    mobility: 'public' as 'walk' | 'bike' | 'public' | 'grab',
    budget_per_day: undefined as number | undefined,
    languages: ['th'] as string[],
  })
  // Last loaded/saved values, used to show "unsaved changes"
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const isDirty = useMemo(() => savedSnapshot !== '' && JSON.stringify(formData) !== savedSnapshot, [formData, savedSnapshot])

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  // Load profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (user && !authLoading) {
        try {
          const { profile: profileData, error } = await getProfile()
          if (error) {
            toast.error(`${t('profile.loadFailed')} ${error}`)
          } else {
            setProfile(profileData)
            const loaded = {
              nick_name: profileData?.nick_name || '',
              avatar_url: profileData?.avatar_url || '',
              birth_year: profileData?.birth_year || undefined,
              travel_style: profileData?.travel_style || [],
              mobility: profileData?.mobility || 'public',
              budget_per_day: profileData?.budget_per_day ?? 1500,
              languages: profileData?.languages || ['th'],
            }
            setFormData(loaded)
            setSavedSnapshot(JSON.stringify(loaded))
          }
        } catch (error) {
          toast.error(t('profile.loadFailed'))
        } finally {
          setLoading(false)
        }
      }
    }

    loadProfile()
  }, [user, authLoading, getProfile])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value ? parseInt(value) : undefined) : value,
    }))
  }

  const handleCheckboxChange = (value: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      travel_style: checked 
        ? [...prev.travel_style, value]
        : prev.travel_style.filter(item => item !== value)
    }))
  }

  const handleLanguageChange = (index: number, value: string) => {
    setFormData(prev => {
      const newLanguages = [...prev.languages]
      newLanguages[index] = value
      return { ...prev, languages: newLanguages }
    })
  }

  const handleImageUpload = (url: string) => {
    setFormData(prev => ({ ...prev, avatar_url: url }))
  }

  const handleImageRemove = () => {
    setFormData(prev => ({ ...prev, avatar_url: '' }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      // Send explicit empty values ('' / null / []) so removed photos and cleared fields are persisted
      const updates = {
        nick_name: formData.nick_name.trim() || undefined,
        avatar_url: formData.avatar_url || '',
        birth_year: formData.birth_year ?? null,
        travel_style: formData.travel_style,
        mobility: formData.mobility,
        budget_per_day: formData.budget_per_day ?? null,
        languages: formData.languages.map(lang => lang.trim().toLowerCase()).filter(Boolean),
      }

      const { profile: updatedProfile, error } = await updateProfile(updates)
      
      if (error) {
        toast.error(`${t('profile.saveFailed')} ${error}`)
      } else {
        setProfile(updatedProfile)
        if (updatedProfile) {
          const saved = {
            nick_name: updatedProfile.nick_name || '',
            avatar_url: updatedProfile.avatar_url || '',
            birth_year: updatedProfile.birth_year || undefined,
            travel_style: updatedProfile.travel_style || [],
            mobility: updatedProfile.mobility || 'public',
            budget_per_day: updatedProfile.budget_per_day ?? undefined,
            languages: updatedProfile.languages?.length ? updatedProfile.languages : ['th'],
          }
          setFormData(saved)
          setSavedSnapshot(JSON.stringify(saved))
        }
        await refreshProfile()
        toast.success(t('profile.saved'))
      }
    } catch (error) {
      toast.error(t('profile.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  // Show loading state
  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
        <span className="ml-3 text-muted-foreground">{t("profile.loading")}</span>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const travelStyles = [
    { value: 'slow-life', labelKey: 'profile.styleSlowLife', descKey: 'profile.styleSlowLifeDesc' },
    { value: 'budget', labelKey: 'profile.styleBudget', descKey: 'profile.styleBudgetDesc' },
    { value: 'instagram', labelKey: 'profile.styleInstagram', descKey: 'profile.styleInstagramDesc' },
    { value: 'foodie', labelKey: 'profile.styleFoodie', descKey: 'profile.styleFoodieDesc' },
    { value: 'history', labelKey: 'profile.styleHistory', descKey: 'profile.styleHistoryDesc' },
  ]

  const mobilityOptions = [
    { value: 'walk' as const, labelKey: 'profile.mobilityWalk', icon: Footprints },
    { value: 'bike' as const, labelKey: 'profile.mobilityBike', icon: Bike },
    { value: 'public' as const, labelKey: 'profile.mobilityPublic', icon: Bus },
    { value: 'grab' as const, labelKey: 'profile.mobilityGrab', icon: Car },
  ]

  const inputClass = 'h-12 rounded-xl bg-card px-4 text-base'
  const sectionTitle = 'font-display text-2xl font-semibold text-foreground'
  const displayName = formData.nick_name || user.email

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
      <header className="mb-10">
        <p className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-primary">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-saffron" />
          {t("profile.eyebrow")}
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl">{t("profile.pageTitle")}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{t("profile.pageSubtitle")}</p>
      </header>

      <form onSubmit={handleSubmit} className="grid gap-10 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Identity column */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-card">
            <ImageUpload
              currentImageUrl={formData.avatar_url}
              onImageUpload={handleImageUpload}
              onImageRemove={handleImageRemove}
              disabled={saving}
              size="lg"
              layout="stacked"
            />
            <div className="mt-5 border-t border-border pt-5">
              <p className="truncate font-display text-xl font-semibold text-foreground">{displayName}</p>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-accent/60 p-6">
            <div className="flex items-center gap-2 font-medium text-accent-foreground">
              <ClipboardList className="h-5 w-5" aria-hidden />
              {t("profile.travelSurvey")}
            </div>
            <p className="mt-2 text-sm text-accent-foreground/80">
              {profile?.onboarding_completed ? t("profile.surveyCompleted") : t("profile.surveyPending")}
            </p>
            <Button
              type="button"
              variant={profile?.onboarding_completed ? 'outline' : 'default'}
              onClick={() => router.push('/onboarding')}
              className="mt-4 h-11 w-full rounded-full"
            >
              {profile?.onboarding_completed ? t("profile.editSurvey") : t("profile.completeSurvey")}
            </Button>
          </div>
        </aside>

        {/* Form sections */}
        <div className="min-w-0 space-y-12">
          <section aria-labelledby="info-heading">
            <h2 id="info-heading" className={sectionTitle}>{t("profile.profileInfo")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("profile.profileInfoDesc")}</p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="nick_name">{t("profile.displayName")}</Label>
                <Input
                  id="nick_name"
                  name="nick_name"
                  type="text"
                  value={formData.nick_name}
                  onChange={handleInputChange}
                  placeholder={t("profile.displayNamePlaceholder")}
                  required
                  aria-describedby="nick-help"
                  className={inputClass}
                />
                <p id="nick-help" className="text-sm text-muted-foreground">{t("profile.displayNameDesc")}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("profile.emailLabel")}</Label>
                <Input id="email" type="email" value={user.email || ''} disabled aria-describedby="email-help" className={cn(inputClass, 'bg-muted')} />
                <p id="email-help" className="text-sm text-muted-foreground">{t("profile.emailReadOnly")}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="birth_year">{t("profile.birthYear")}</Label>
                <Input
                  id="birth_year"
                  name="birth_year"
                  type="number"
                  inputMode="numeric"
                  min="1900"
                  max="2010"
                  value={formData.birth_year || ''}
                  onChange={handleInputChange}
                  placeholder={t("profile.birthYearPlaceholder")}
                  aria-describedby="birth-help"
                  className={inputClass}
                />
                <p id="birth-help" className="text-sm text-muted-foreground">{t("profile.birthYearDesc")}</p>
              </div>
            </div>
          </section>

          <section aria-labelledby="style-heading">
            <h2 id="style-heading" className={sectionTitle}>{t("profile.travelStyle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("profile.travelStyleDesc")}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2" role="group" aria-labelledby="style-heading">
              {travelStyles.map((style) => {
                const selected = formData.travel_style.includes(style.value)
                return (
                  <button
                    key={style.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => handleCheckboxChange(style.value, !selected)}
                    className={cn(
                      'flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors',
                      selected ? 'border-primary bg-teal-soft' : 'border-border bg-card hover:border-primary/40'
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                        selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card'
                      )}
                      aria-hidden
                    >
                      {selected && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span>
                      <span className="block font-medium text-foreground">{t(style.labelKey)}</span>
                      <span className="block text-sm text-muted-foreground">{t(style.descKey)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section aria-labelledby="prefs-heading">
            <h2 id="prefs-heading" className={sectionTitle}>{t("profile.travelPrefs")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("profile.travelPrefsDesc")}</p>

            <fieldset className="mt-6">
              <legend className="mb-3 text-sm font-medium text-foreground">{t("profile.mobility")}</legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {mobilityOptions.map(({ value, labelKey, icon: Icon }) => {
                  const selected = formData.mobility === value
                  return (
                    <label
                      key={value}
                      className={cn(
                        'flex cursor-pointer flex-col items-center gap-2 rounded-2xl border p-4 text-center text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                        selected ? 'border-primary bg-teal-soft text-primary' : 'border-border bg-card text-foreground hover:border-primary/40'
                      )}
                    >
                      <input
                        type="radio"
                        name="mobility"
                        value={value}
                        checked={selected}
                        onChange={handleInputChange}
                        className="sr-only"
                      />
                      <Icon className="h-6 w-6" aria-hidden />
                      {t(labelKey)}
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <div className="mt-6 max-w-xs space-y-2">
              <Label htmlFor="budget_per_day">{t("profile.budget")}</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">฿</span>
                <Input
                  id="budget_per_day"
                  name="budget_per_day"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="100"
                  value={formData.budget_per_day || ''}
                  onChange={handleInputChange}
                  placeholder={t("profile.budgetPlaceholder")}
                  aria-describedby="budget-help"
                  className={cn(inputClass, 'pl-9')}
                />
              </div>
              <p id="budget-help" className="text-sm text-muted-foreground">{t("profile.budgetDesc")}</p>
            </div>
          </section>

          <section aria-labelledby="lang-heading">
            <h2 id="lang-heading" className={sectionTitle}>{t("profile.languages")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("profile.languagesDesc")}</p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              {formData.languages.map((lang, index) => (
                <div key={index} className="flex items-center rounded-full border border-border bg-card pl-3">
                  <label htmlFor={`lang-${index}`} className="sr-only">{t("profile.languagePlaceholder")}</label>
                  <input
                    id={`lang-${index}`}
                    type="text"
                    value={lang}
                    onChange={(e) => handleLanguageChange(index, e.target.value)}
                    placeholder="th"
                    maxLength={8}
                    className="h-10 w-14 bg-transparent text-sm font-medium uppercase text-foreground focus:outline-none"
                  />
                  {formData.languages.length > 1 && (
                    <button
                      type="button"
                      aria-label={`${t("profile.remove")} ${lang}`}
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          languages: prev.languages.filter((_, i) => i !== index)
                        }))
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormData(prev => ({ ...prev, languages: [...prev.languages, ''] }))}
                className="h-10 rounded-full border-dashed"
              >
                <Plus className="h-4 w-4" aria-hidden />
                {t("profile.addLanguage")}
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{t("profile.languageCodeHint")}</p>
          </section>

          {/* Save bar: compact pill pinned to the bottom-right while scrolling */}
          <div className="pointer-events-none sticky bottom-4 z-10 flex justify-end">
            <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-border bg-card/95 py-1.5 pl-5 pr-1.5 shadow-card-hover backdrop-blur">
              <span className="text-sm text-muted-foreground" aria-live="polite">
                {isDirty ? (
                  <span className="inline-flex items-center gap-2 text-accent-foreground">
                    <span aria-hidden className="h-2 w-2 rounded-full bg-saffron" />
                    {t("profile.unsaved")}
                  </span>
                ) : (
                  t("profile.allSaved")
                )}
              </span>
              <Button type="submit" disabled={saving || !isDirty} className="h-11 rounded-full px-6">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                {saving ? t("profile.saving") : t("profile.saveProfile")}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
