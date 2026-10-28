'use client'

import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { User, LogOut, Settings } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useTranslation } from '@/contexts/language-context'

export function AuthButton() {
  const { user, signOut, loading, profile } = useAuth()
  const { t } = useTranslation()

  const handleSignOut = async () => {
    try {
      const { error } = await signOut()
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Signed out successfully')
      }
    } catch (error) {
      toast.error('An error occurred while signing out')
    }
  }

  if (loading) {
    return (
      <div className="h-10 w-36 animate-pulse rounded-full bg-secondary" aria-hidden />
    )
  }

  if (!user) {
    return (
      <div className="flex items-center gap-1">
        <Button asChild variant="ghost" className="h-10 rounded-full px-4 text-foreground hover:bg-secondary">
          <Link href="/auth/login">{t("nav.signIn")}</Link>
        </Button>
        <Button asChild className="h-10 rounded-full px-5">
          <Link href="/auth/register">{t("nav.signUp")}</Link>
        </Button>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex h-10 items-center gap-2 rounded-full px-3 text-foreground hover:bg-secondary">
          {profile?.avatar_url ? (
            <img 
              src={profile.avatar_url} 
              alt="Profile" 
              className="h-7 w-7 rounded-full object-cover border border-border"
            />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-soft text-primary">
              <User className="h-4 w-4" />
            </span>
          )}
          <span className="max-w-[10rem] truncate">{profile?.nick_name || user.user_metadata?.display_name || user.email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-white text-slate-950 border border-slate-200 shadow-lg">
        <DropdownMenuLabel className="flex items-center gap-2 rounded-md px-2 py-2 text-slate-950">
          {profile?.avatar_url ? (
            <img 
              src={profile.avatar_url} 
              alt="Profile" 
              className="h-8 w-8 rounded-full object-cover border border-gray-200"
            />
          ) : (
            <User className="h-6 w-6" />
          )}
          <div>
            <div className="font-medium text-slate-950">{profile?.nick_name || user.user_metadata?.display_name || 'User'}</div>
            <div className="text-xs text-slate-500">{user.email}</div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-200" />
        <DropdownMenuItem asChild className="text-slate-700 hover:bg-slate-100 focus:bg-blue-50 focus:text-slate-900">
          <Link href="/profile" className="flex items-center">
            <Settings className="mr-2 h-4 w-4 text-slate-700" />
            <span>Profile Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-slate-200" />
        <DropdownMenuItem onClick={handleSignOut} className="text-slate-700 hover:bg-slate-100 focus:bg-blue-50 focus:text-slate-900">
          <LogOut className="mr-2 h-4 w-4 text-slate-700" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}