'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from './button'
import { Input } from './input'
import { Label } from './label'
import { X, Loader2, Camera, User } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/contexts/language-context'

interface ImageUploadProps {
  currentImageUrl?: string
  onImageUpload: (url: string) => void
  onImageRemove: () => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  /** inline: avatar beside the buttons; stacked: avatar above, buttons in a row (narrow columns) */
  layout?: 'inline' | 'stacked'
  className?: string
}

export function ImageUpload({ 
  currentImageUrl, 
  onImageUpload, 
  onImageRemove, 
  disabled = false,
  size = 'md',
  layout = 'inline',
  className = ''
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const { t } = useTranslation()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Size configurations
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32'
  }

  const iconSizes = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8', 
    lg: 'h-12 w-12'
  }

  const validateFile = (file: File): string | null => {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return t('imageUpload.invalidType')
    }

    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024 // 5MB in bytes
    if (file.size > maxSize) {
      return t('imageUpload.tooLarge')
    }

    return null
  }

  const uploadImage = useCallback(async (file: File) => {
    try {
      setUploading(true)

      // Validate file
      const validationError = validateFile(file)
      if (validationError) {
        toast.error(validationError)
        setPreviewUrl(null)
        return
      }

      // Check if Supabase client is properly initialized
      if (!supabase) {
        toast.error(t('imageUpload.unavailable'))
        return
      }

      // Create unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('user-uploads')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        toast.error(t('imageUpload.failedWith', { message: error.message }))
        setPreviewUrl(null)
        return
      }

      if (!data || !data.path) {
        toast.error(t('imageUpload.noPath'))
        return
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(data.path)

      if (!publicUrl) {
        console.error('No public URL generated')
        toast.error(t('imageUpload.noUrl'))
        return
      }

      onImageUpload(publicUrl)
      setPreviewUrl(null)
      toast.success(t('imageUpload.uploaded'))

    } catch (error: any) {
      console.error('Upload error details:', {
        message: error.message,
        error: error,
        stack: error.stack
      })
      toast.error(t('imageUpload.failedWith', { message: error.message || t('imageUpload.unknownError') }))
      setPreviewUrl(null)
    } finally {
      setUploading(false)
    }
  }, [supabase, onImageUpload, t])

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Reset so picking the same file again still fires onChange
    event.target.value = ''
    if (!file) return

    // Show preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Upload the file
    uploadImage(file)
  }, [uploadImage])

  // Only clears the field; the stored file is left alone until the profile is saved elsewhere
  const handleRemoveImage = useCallback(() => {
    onImageRemove()
    setPreviewUrl(null)
  }, [onImageRemove])

  const openFileDialog = () => {
    fileInputRef.current?.click()
  }

  const displayUrl = previewUrl || currentImageUrl

  const stacked = layout === 'stacked'

  return (
    <div className={`space-y-4 ${className}`}>
      <Label className="sr-only">{t('imageUpload.label')}</Label>

      <div className={stacked ? 'flex flex-col items-center gap-4 text-center' : 'flex items-center gap-4'}>
        {/* Avatar Display */}
        <div className={`relative ${sizeClasses[size]} flex-shrink-0`}>
          <div className={`${sizeClasses[size]} rounded-full border-2 border-dashed border-border bg-teal-soft flex items-center justify-center overflow-hidden`}>
            {displayUrl ? (
              <img
                src={displayUrl}
                alt={t('imageUpload.alt')}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <User className={`${iconSizes[size]} text-primary/60`} />
            )}
          </div>

          {/* Loading overlay */}
          {uploading && (
            <div className="absolute inset-0 bg-foreground/50 rounded-full flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className={stacked ? 'flex flex-wrap justify-center gap-2' : 'flex flex-col gap-2'}>
          <Button
            type="button"
            variant="outline"
            onClick={openFileDialog}
            disabled={disabled || uploading}
            className="h-10 rounded-full px-4"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {uploading ? t('imageUpload.uploading') : t('imageUpload.change')}
          </Button>

          {displayUrl && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleRemoveImage}
              disabled={disabled || uploading}
              className="h-10 rounded-full px-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-4 w-4" />
              {t('imageUpload.remove')}
            </Button>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <Input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        disabled={disabled || uploading}
        className="hidden"
      />

      <p className={`text-xs text-muted-foreground ${stacked ? 'text-center' : ''}`}>
        {t('imageUpload.hint')}
      </p>
    </div>
  )
}
