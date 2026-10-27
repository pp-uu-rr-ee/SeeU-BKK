'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/auth-context'
import { useTranslation } from '@/contexts/language-context'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { AuthHeading, authInputClass } from './auth-shell'
import { PasswordInput } from './password-input'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, getOnboardingStatus } = useAuth()
  const { t } = useTranslation()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await signIn(email, password)

      if (error) {
        toast.error(error.message)
      } else {
        const { completed, skipped } = await getOnboardingStatus()
        toast.success(t('auth.signedIn'))
        router.push(completed || skipped ? '/' : '/onboarding')
      }
    } catch (error) {
      toast.error(t('auth.unexpectedError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <AuthHeading title={t('auth.signInTitle')} subtitle={t('auth.signInSubtitle')} />
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">{t('auth.email')}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className={authInputClass}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Link href="/auth/reset-password" className="text-sm font-medium text-primary hover:underline">
              {t('auth.forgotPassword')}
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder={t('auth.passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <Button type="submit" className="h-12 w-full rounded-full text-base" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {t('auth.signIn')}
        </Button>
      </form>
      <p className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
        {t('auth.noAccount')}{' '}
        <Link href="/auth/register" className="font-medium text-primary hover:underline">
          {t('auth.createAccount')}
        </Link>
      </p>
    </>
  )
}
