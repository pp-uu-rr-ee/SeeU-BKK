import type { OnboardingPreferences } from '@/contexts/auth-context'

export const EMPTY_ONBOARDING_PREFERENCES: OnboardingPreferences = {
  vibes: [],
  travelStyle: '',
  pace: 50,
  transit: [],
  culinary: [],
  boundaries: [],
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

/** Normalises stored onboarding_preferences (jsonb) into form state for the survey. */
export function toOnboardingPreferences(raw: unknown): OnboardingPreferences {
  const saved = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const pace = typeof saved.pace === 'number' && Number.isFinite(saved.pace)
    ? Math.min(100, Math.max(0, saved.pace))
    : EMPTY_ONBOARDING_PREFERENCES.pace

  return {
    vibes: stringList(saved.vibes),
    travelStyle: typeof saved.travelStyle === 'string' ? saved.travelStyle : '',
    pace,
    transit: stringList(saved.transit),
    culinary: stringList(saved.culinary),
    boundaries: stringList(saved.boundaries),
  }
}
