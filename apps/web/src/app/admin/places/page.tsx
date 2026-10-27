"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, Trash2, Plus, Search, ImageOff, Loader2, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Place {
  id: string
  name: string
  description: string
  tags: string[]
  lat: number
  lng: number
  address: string
  price: number
  image_url: string
  slug?: string
  name_th?: string | null
  is_published?: boolean
  has_embedding?: boolean
}

interface PaginationInfo {
  limit: number
  offset: number
  count: number
  total: number
}

export default function AdminPlacesPage() {
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationInfo>({ limit: 20, offset: 0, count: 0, total: 0 })
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const router = useRouter()

  const fetchPlaces = async (searchTerm = '', page = 1) => {
    try {
      setLoading(true)
      setError(null)

      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const limit = 20
      const offset = (page - 1) * limit
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      })
      
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim())
      }
      
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
      const res = await fetch(`${serverUrl}/api/admin/places?${params}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
          'Content-Type': 'application/json',
        },
      })
      
      // Safely parse response, handling non-JSON errors gracefully
      const contentType = res.headers.get('content-type') || ''
      const data = contentType.includes('application/json')
        ? await res.json()
        : { success: false, error: (await res.text()) || 'Unexpected response from server' }
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch places')
      }
      
      setPlaces(data.data || [])
      setPagination(data.pagination || { limit, offset, count: 0, total: 0 })
    } catch (e: any) {
      setError(e?.message || 'Failed to load places')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return
    }
    
    try {
      setDeleteLoading(id)

      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
      const res = await fetch(`${serverUrl}/api/admin/places/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
      })
      
      const contentType = res.headers.get('content-type') || ''
      const data = contentType.includes('application/json')
        ? await res.json()
        : { success: false, error: (await res.text()) || 'Unexpected response from server' }
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete place')
      }
      
      // Refresh the list
      fetchPlaces(search, currentPage)
      alert(`Place "${name}" has been deleted successfully.`)
    } catch (e: any) {
      alert(e?.message || 'Failed to delete place')
    } finally {
      setDeleteLoading(null)
    }
  }

  const handleSearch = () => {
    setCurrentPage(1)
    fetchPlaces(search, 1)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    fetchPlaces(search, page)
  }

  useEffect(() => {
    fetchPlaces()
  }, [])

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit))
  const missingEmbeddings = places.filter((p) => !p.has_embedding).length

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14">
      {/* Header */}
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-primary">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-saffron" />
            Admin
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground">Places</h1>
          <p className="mt-2 text-muted-foreground">{pagination.total} places in the catalog</p>
        </div>
        <Button asChild className="h-11 rounded-full px-5">
          <Link href="/admin/places/new">
            <Plus className="h-4 w-4" aria-hidden />
            Add place
          </Link>
        </Button>
      </header>

      {/* Search */}
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          handleSearch()
        }}
        className="mb-6 flex gap-3"
      >
        <div className="relative flex-1">
          <label htmlFor="admin-search" className="sr-only">Search places</label>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="admin-search"
            type="search"
            placeholder="Search by name or description (English or Thai)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-12 rounded-full bg-card pl-11 text-base"
          />
        </div>
        <Button type="submit" variant="secondary" disabled={loading} className="h-12 rounded-full px-6">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : 'Search'}
        </Button>
      </form>

      {missingEmbeddings > 0 && (
        <p className="mb-6 rounded-2xl border border-saffron/40 bg-accent/60 px-5 py-3 text-sm text-accent-foreground">
          {missingEmbeddings} place(s) on this page have no embedding, so AI search can&apos;t find them yet.
          Run <code className="rounded bg-card px-1.5 py-0.5 text-xs">bun run db:embed</code> in <code className="rounded bg-card px-1.5 py-0.5 text-xs">apps/server</code>.
        </p>
      )}

      {error && (
        <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={() => fetchPlaces(search, currentPage)} variant="outline" className="h-10 rounded-full border-destructive/30 text-destructive">
            Try again
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">Places</caption>
            <thead className="border-b border-border bg-muted text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Place</th>
                <th scope="col" className="px-5 py-3 font-medium">Tags</th>
                <th scope="col" className="px-5 py-3 font-medium">Price</th>
                <th scope="col" className="px-5 py-3 font-medium">Status</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && places.length === 0
                ? Array.from({ length: 5 }, (_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-5 py-4">
                        <div className="h-12 animate-pulse rounded-lg bg-secondary" />
                      </td>
                    </tr>
                  ))
                : places.map((place) => (
                    <tr key={place.id} className="transition-colors hover:bg-muted/60">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-teal-soft">
                            {place.image_url ? (
                              <img src={place.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-primary/40"><ImageOff className="h-4 w-4" aria-hidden /></div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{place.name}</p>
                            {place.name_th && <p className="truncate text-xs text-muted-foreground">{place.name_th}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {place.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-foreground">{tag}</span>
                          ))}
                          {place.tags.length > 3 && <span className="text-xs text-muted-foreground">+{place.tags.length - 3}</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3 tabular-nums text-foreground">{place.price > 0 ? `฿${place.price}` : 'Free'}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-medium',
                              place.is_published === false ? 'bg-secondary text-muted-foreground' : 'bg-teal-soft text-primary'
                            )}
                          >
                            {place.is_published === false ? 'Draft' : 'Published'}
                          </span>
                          {!place.has_embedding && (
                            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">No embedding</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label={`View ${place.name}`}>
                            <Link href={`/places/${place.slug || ''}`} target="_blank">
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(`/admin/places/${place.id}/edit`)}
                            className="h-10 w-10 rounded-full"
                            aria-label={`Edit ${place.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(place.id, place.name)}
                            disabled={deleteLoading === place.id}
                            className="h-10 w-10 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Delete ${place.name}`}
                          >
                            {deleteLoading === place.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {places.length === 0 && !loading && (
          <div className="px-6 py-12 text-center">
            <p className="text-muted-foreground">{search ? 'No places match your search.' : 'No places yet.'}</p>
            {search && (
              <Button
                variant="secondary"
                className="mt-4 h-10 rounded-full"
                onClick={() => { setSearch(''); fetchPlaces('', 1); setCurrentPage(1) }}
              >
                Clear search
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.total > pagination.limit && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {pagination.offset + 1}–{pagination.offset + pagination.count} of {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              disabled={currentPage <= 1 || loading}
              onClick={() => handlePageChange(currentPage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-sm text-foreground">{currentPage} / {totalPages}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              disabled={pagination.offset + pagination.count >= pagination.total || loading}
              onClick={() => handlePageChange(currentPage + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </nav>
      )}
    </div>
  )
}
