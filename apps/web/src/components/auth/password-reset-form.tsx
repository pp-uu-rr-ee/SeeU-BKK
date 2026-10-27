'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/auth-context'
import { useTranslation } from '@/contexts/language-context'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, MailCheck } from 'lucide-react'
import { AuthHeading, authInputClass } from './auth-shell'

export function PasswordResetForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { resetPassword } = useAuth()
  const { t } = useTranslation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await resetPassword(email)

      if (error) {
        toast.error(error.message)
      } else {
        setSent(true)
        toast.success(t('auth.resetSent'))
      }
    } catch (error) {
      toast.error(t('auth.unexpectedError'))
    } finally {
      setLoading(false)
    }
  }

  const backLink = (
    <Link
      href="/auth/login"
      className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {t('auth.backToSignIn')}
    </Link>
  )

  if (sent) {
    return (
      <div role="status">
        <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-teal-soft text-primary">
          <MailCheck className="h-7 w-7" aria-hidden />
        </span>
        <AuthHeading title={t('auth.checkEmailTitle')} subtitle={t('auth.resetSentTo', { email })} />
        <p className="text-sm text-muted-foreground">{t('auth.notReceived')}</p>
        <Button variant="secondary" onClick={() => setSent(false)} className="mt-6 h-12 w-full rounded-full text-base">
          {t('auth.tryAgain')}
        </Button>
        {backLink}
      </div>
    )
  }

  return (
    <>
      <AuthHeading title={t('auth.resetTitle')} subtitle={t('auth.resetSubtitle')} />
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
        <Button type="submit" className="h-12 w-full rounded-full text-base" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {t('auth.sendReset')}
        </Button>
      </form>
      {backLink}
    </>
  )
}
