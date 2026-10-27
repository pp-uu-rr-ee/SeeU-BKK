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

export function RegisterForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [fieldError, setFieldError] = useState<{ field: 'password' | 'confirm'; message: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const { t } = useTranslation()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password.length < 6) {
      setFieldError({ field: 'password', message: t('auth.passwordTooShort') })
      return
    }

    if (password !== confirmPassword) {
      setFieldError({ field: 'confirm', message: t('auth.passwordMismatch') })
      return
    }

    setFieldError(null)
    setLoading(true)

    try {
      const { error } = await signUp(email, password, {
        display_name: displayName
      })

      if (error) {
        toast.error(error.message)
      } else {
        toast.success(t('auth.registered'))
        router.push('/auth/verify-email')
      }
    } catch (error) {
      toast.error(t('auth.unexpectedError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <AuthHeading title={t('auth.registerTitle')} subtitle={t('auth.registerSubtitle')} />
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="displayName">{t('auth.displayName')}</Label>
          <Input
            id="displayName"
            autoComplete="nickname"
            placeholder={t('auth.displayNamePlaceholder')}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            disabled={loading}
            className={authInputClass}
          />
        </div>
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
          <Label htmlFor="password">{t('auth.newPassword')}</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder={t('auth.newPasswordPlaceholder')}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (fieldError?.field === 'password') setFieldError(null)
            }}
            required
            disabled={loading}
            aria-invalid={fieldError?.field === 'password'}
            aria-describedby="password-help"
          />
          <p
            id="password-help"
            className={fieldError?.field === 'password' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}
          >
            {fieldError?.field === 'password' ? fieldError.message : t('auth.passwordHint')}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            placeholder={t('auth.confirmPasswordPlaceholder')}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              if (fieldError?.field === 'confirm') setFieldError(null)
            }}
            required
            disabled={loading}
            aria-invalid={fieldError?.field === 'confirm'}
            aria-describedby={fieldError?.field === 'confirm' ? 'confirm-error' : undefined}
          />
          {fieldError?.field === 'confirm' && (
            <p id="confirm-error" className="text-sm text-destructive">{fieldError.message}</p>
          )}
        </div>
        <Button type="submit" className="h-12 w-full rounded-full text-base" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {t('auth.register')}
        </Button>
      </form>
      <p className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
        {t('auth.haveAccount')}{' '}
        <Link href="/auth/login" className="font-medium text-primary hover:underline">
          {t('auth.signIn')}
        </Link>
      </p>
    </>
  )
}
