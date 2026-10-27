"use client"

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MailCheck, ArrowLeft } from 'lucide-react'
import { AuthHeading } from '@/components/auth/auth-shell'
import { useTranslation } from '@/contexts/language-context'

export default function VerifyEmailPage() {
  const { t } = useTranslation()

  return (
    <div role="status">
      <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-teal-soft text-primary">
        <MailCheck className="h-7 w-7" aria-hidden />
      </span>
      <AuthHeading title={t('auth.verifyTitle')} subtitle={t('auth.verifyDesc')} />
      <p className="text-sm text-muted-foreground">{t('auth.verifyHelp')}</p>
      <Button asChild variant="secondary" className="mt-6 h-12 w-full rounded-full text-base">
        <Link href="/auth/login">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t('auth.backToSignIn')}
        </Link>
      </Button>
    </div>
  )
}
