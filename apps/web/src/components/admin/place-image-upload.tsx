"use client"

import { useRef, useState } from 'react'
import { ImageIcon, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useTranslation } from '@/contexts/language-context'
import { createClient } from '@/lib/supabase/client'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

interface PlaceImageUploadProps {
  /** Current image_url (ours or an external link) */
  value: string
  onChange: (url: string) => void
}

/** Preview plus "Upload photo": the server stores the file in our place-images bucket and returns its URL */
export function PlaceImageUpload({ value, onChange }: PlaceImageUploadProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  // Remember which URL failed so pasting a new one shows its preview again
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  const upload = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(t('imageUpload.invalidType'))
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error(t('imageUpload.tooLarge'))
      return
    }

    setUploading(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
      const body = new FormData()
      body.append('file', file)
      const res = await fetch(`${serverUrl}/api/admin/places/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        body,
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success || !json?.data?.url) {
        throw new Error(json?.message || json?.error || `HTTP ${res.status}`)
      }
      onChange(json.data.url)
      toast.success(t('admin.imageUploaded'))
    } catch (error) {
      toast.error(t('imageUpload.failedWith', { message: error instanceof Error ? error.message : t('imageUpload.unknownError') }))
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="mt-2 flex items-center gap-3">
      <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary">
        {value && value !== failedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt={t('admin.imagePreview')}
            className="h-full w-full object-cover"
            onError={() => setFailedUrl(value)}
          />
        ) : (
          <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0">
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void upload(file)
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
          {uploading ? t('imageUpload.uploading') : t('admin.uploadImage')}
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">{t('admin.uploadImageHint')}</p>
      </div>
    </div>
  )
}
