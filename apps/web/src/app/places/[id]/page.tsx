"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { nameToSlug } from '@/lib/slug-utils';
import { formatTime, isOpenAt, type OpeningHour } from '@/lib/opening-hours';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/contexts/language-context';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  MapPin,
  ArrowLeft,
  ArrowRight,
  Clock,
  Star,
  Share2,
  Heart,
  Navigation,
  ImageOff,
  Users,
  Plus,
  ExternalLink,
  Phone,
  Globe,
  ChevronRight,
  Sparkles,
  Loader2,
  Trash2,
  Ticket,
} from 'lucide-react';

interface Place {
  id: string;
  name: string;
  description: string;
  name_th?: string | null;
  description_th?: string | null;
  tags: string[];
  lat: number;
  lng: number;
  address: string;
  price: number;
  image_url: string;
  slug: string;
  phone?: string | null;
  website?: string | null;
  suggested_duration_min?: number | null;
  best_for: string[];
  avg_rating: number | null;
  review_count: number;
  opening_hours: OpeningHour[];
}

interface NearbyPlace {
  id: string;
  name: string;
  name_th?: string | null;
  image_url: string;
  tags: string[];
  slug: string;
  price?: number;
  distance_km?: number;
}

interface Review {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  author: { nick_name: string | null; avatar_url: string | null };
}

const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000';

function StarRow({ rating, size = 'h-5 w-5', onSelect }: { rating: number; size?: string; onSelect?: (value: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((value) => {
        const filled = value <= Math.round(rating);
        const star = (
          <Star className={cn(size, filled ? 'fill-saffron text-saffron' : 'text-border')} aria-hidden />
        );
        return onSelect ? (
          <button
            key={value}
            type="button"
            aria-label={`${value} / 5`}
            aria-pressed={value === rating}
            onClick={() => onSelect(value)}
            className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-accent"
          >
            {star}
          </button>
        ) : (
          <span key={value}>{star}</span>
        );
      })}
    </div>
  );
}

export default function PlaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { session, user } = useAuth();
  const { t, locale } = useTranslation();
  const [place, setPlace] = useState<Place | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isFavoriteSaving, setIsFavoriteSaving] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [draftRating, setDraftRating] = useState(0);
  const [draftComment, setDraftComment] = useState('');
  const [isReviewSaving, setIsReviewSaving] = useState(false);

  const placeSlug = params.id as string;
  const accessToken = session?.access_token;

  const fetchPlaceDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${serverUrl}/api/places/${placeSlug}`);
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success || !result.data) {
        throw new Error(result?.message || `HTTP error! status: ${response.status}`);
      }

      const data = result.data;
      setPlace({
        ...data,
        image_url: data.image_url || '',
        tags: Array.isArray(data.tags) ? data.tags : [],
        best_for: Array.isArray(data.best_for) ? data.best_for : [],
        description: data.description || '',
        address: data.address || '',
        price: typeof data.price === 'number' ? data.price : 0,
        avg_rating: typeof data.avg_rating === 'number' ? data.avg_rating : null,
        review_count: data.review_count || 0,
        opening_hours: Array.isArray(data.opening_hours) ? data.opening_hours : [],
      });
    } catch (err) {
      console.error('Error fetching place details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load place details');
    } finally {
      setLoading(false);
    }
  }, [placeSlug]);

  const fetchNearbyPlaces = useCallback(async () => {
    try {
      const response = await fetch(`${serverUrl}/api/places/${placeSlug}/nearby?limit=4`);
      if (!response.ok) return;

      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setNearbyPlaces(result.data.map((p: any) => ({
          ...p,
          image_url: p.image_url || '',
          tags: Array.isArray(p.tags) ? p.tags : [],
          name: p.name || 'Unknown Place',
          slug: p.slug || nameToSlug(p.name || 'unknown-place'),
        })));
      }
    } catch (err) {
      console.error('Error fetching nearby places:', err);
    }
  }, [placeSlug]);

  const fetchReviews = useCallback(async () => {
    try {
      const response = await fetch(`${serverUrl}/api/places/${placeSlug}/reviews`);
      if (!response.ok) return;
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setReviews(result.data);
        setPlace((prev) => prev && result.summary
          ? { ...prev, avg_rating: result.summary.avg_rating, review_count: result.summary.review_count }
          : prev);
      }
    } catch (err) {
      console.error('Error fetching reviews:', err);
    }
  }, [placeSlug]);

  useEffect(() => {
    if (placeSlug) {
      fetchPlaceDetails();
      fetchNearbyPlaces();
      fetchReviews();
    }
  }, [placeSlug, fetchPlaceDetails, fetchNearbyPlaces, fetchReviews]);

  // Load favorite state once both the place and the session are known
  useEffect(() => {
    if (!place || !accessToken) {
      setIsFavorite(false);
      return;
    }
    let cancelled = false;
    fetch(`${serverUrl}/api/favorites`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (!cancelled && result?.success) {
          setIsFavorite((result.placeIds || []).includes(place.id));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [place?.id, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const myReview = useMemo(
    () => (user ? reviews.find((r) => r.user_id === user.id) : undefined),
    [reviews, user]
  );

  // Prefill the form with the user's existing review
  useEffect(() => {
    setDraftRating(myReview?.rating || 0);
    setDraftComment(myReview?.comment || '');
  }, [myReview]);

  const displayName = place ? (locale === 'th' && place.name_th) || place.name : '';
  const displayDescription = place ? (locale === 'th' && place.description_th) || place.description : '';
  const openNow = useMemo(() => (place ? isOpenAt(place.opening_hours, new Date()) : null), [place]);

  const handleShare = async () => {
    try {
      if (navigator.share && place) {
        await navigator.share({
          title: displayName,
          text: displayDescription,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success(t('placeDetail.linkCopied'));
      }
    } catch (err) {
      // User cancelled
    }
  };

  const handleFavorite = async () => {
    if (!place) return;
    if (!accessToken) {
      toast.info(t('placeDetail.loginToFavorite'));
      router.push('/auth/login');
      return;
    }

    const next = !isFavorite;
    setIsFavorite(next);
    setIsFavoriteSaving(true);
    try {
      const response = await fetch(`${serverUrl}/api/favorites/${place.id}`, {
        method: next ? 'PUT' : 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      toast.success(t(next ? 'placeDetail.addedFavorite' : 'placeDetail.removedFavorite'));
    } catch (err) {
      console.error('Error updating favorite:', err);
      setIsFavorite(!next);
      toast.error(t('placeDetail.favoriteFailed'));
    } finally {
      setIsFavoriteSaving(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!accessToken) {
      router.push('/auth/login');
      return;
    }
    if (draftRating < 1) {
      toast.error(t('placeDetail.selectRating'));
      return;
    }
    setIsReviewSaving(true);
    try {
      const response = await fetch(`${serverUrl}/api/places/${placeSlug}/reviews`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ rating: draftRating, comment: draftComment }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      toast.success(t('placeDetail.reviewSaved'));
      await fetchReviews();
    } catch (err) {
      console.error('Error saving review:', err);
      toast.error(t('placeDetail.reviewFailed'));
    } finally {
      setIsReviewSaving(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!accessToken) return;
    setIsReviewSaving(true);
    try {
      const response = await fetch(`${serverUrl}/api/places/${placeSlug}/reviews`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      toast.success(t('placeDetail.reviewDeleted'));
      await fetchReviews();
    } catch (err) {
      console.error('Error deleting review:', err);
      toast.error(t('placeDetail.reviewFailed'));
    } finally {
      setIsReviewSaving(false);
    }
  };

  const openInMaps = () => {
    if (place) {
      const url = `https://www.google.com/maps?q=${place.lat},${place.lng}`;
      window.open(url, '_blank');
    }
  };

  const handleAddToTrip = () => {
    if (place) {
      router.push(`/map?place=${encodeURIComponent(place.slug)}`);
    }
  };

  const handleAskAssistant = () => {
    if (place) {
      router.push(`/map?chat=true&about=${encodeURIComponent(place.name)}`);
    }
  };

  const formatDuration = (minutes: number) =>
    minutes % 60 === 0
      ? t('placeDetail.hours', { n: String(minutes / 60) })
      : minutes > 60
        ? `${t('placeDetail.hours', { n: String(Math.floor(minutes / 60)) })} ${t('placeDetail.minutes', { n: String(minutes % 60) })}`
        : t('placeDetail.minutes', { n: String(minutes) });

  const ratingLabel = (count: number) =>
    t(count === 1 ? 'placeDetail.reviewCount' : 'placeDetail.reviewsCount', { count: String(count) });

  // Loading skeleton
  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6" aria-busy="true">
        <div className="h-4 w-40 animate-pulse rounded bg-secondary" />
        <div className="mt-8 h-12 w-2/3 animate-pulse rounded-lg bg-secondary" />
        <div className="mt-4 h-5 w-1/3 animate-pulse rounded bg-secondary" />
        <div className="mt-8 aspect-[16/9] w-full animate-pulse rounded-3xl bg-secondary md:aspect-[21/9]" />
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            <div className="h-4 w-full animate-pulse rounded bg-secondary" />
            <div className="h-4 w-full animate-pulse rounded bg-secondary" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-secondary" />
          </div>
          <div className="h-64 animate-pulse rounded-2xl bg-secondary" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !place) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="max-w-md text-center" role="alert">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-teal-soft text-primary">
            <MapPin className="h-8 w-8" aria-hidden />
          </div>
          <h1 className="font-display text-3xl font-semibold text-foreground">{t('placeDetail.notFound')}</h1>
          <p className="mt-3 text-muted-foreground">{t('placeDetail.notFoundDesc')}</p>
          <Button asChild className="mt-6 h-11 rounded-full px-6">
            <Link href="/places">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {t('placeDetail.back')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const today = new Date().getDay();
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  return (
    <article className="bg-background pb-20">
      {/* Breadcrumb + actions */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pt-6 sm:px-6">
        <nav aria-label="Breadcrumb" className="min-w-0 text-sm">
          <ol className="flex items-center gap-1.5 text-muted-foreground">
            <li>
              <Link href="/places" className="inline-flex items-center gap-1.5 rounded-full py-2 hover:text-foreground">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                {t('nav.places')}
              </Link>
            </li>
            <li aria-hidden>
              <ChevronRight className="h-4 w-4" />
            </li>
            <li className="truncate text-foreground" aria-current="page">{displayName}</li>
          </ol>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleFavorite}
            disabled={isFavoriteSaving}
            aria-pressed={isFavorite}
            className={cn(
              'h-11 rounded-full border-border bg-card px-4',
              isFavorite && 'border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:text-destructive'
            )}
          >
            <Heart className={cn('h-5 w-5', isFavorite && 'fill-current')} aria-hidden />
            <span>{t(isFavorite ? 'placeDetail.saved' : 'placeDetail.save')}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleShare}
            aria-label="Share"
            className="h-11 w-11 rounded-full border-border bg-card p-0"
          >
            <Share2 className="h-5 w-5" aria-hidden />
          </Button>
        </div>
      </div>

      {/* Title block */}
      <header className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        {place.tags.length > 0 && (
          <p className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium uppercase tracking-[0.18em] text-primary">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-saffron" />
            {place.tags.map((tag) => tag.replace(/-/g, ' ')).join(' · ')}
          </p>
        )}
        <h1 className="max-w-4xl font-display text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl md:text-6xl">
          {displayName}
        </h1>
        {locale === 'th' && place.name_th && place.name !== place.name_th && (
          <p className="mt-2 text-lg text-muted-foreground">{place.name}</p>
        )}

        <dl className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">{t('placeDetail.rating')}</dt>
            <Star className={cn('h-5 w-5', place.avg_rating !== null ? 'fill-saffron text-saffron' : 'text-border')} aria-hidden />
            <dd>
              {place.avg_rating !== null ? (
                <>
                  <span className="font-semibold text-foreground">{place.avg_rating.toFixed(1)}</span>{' '}
                  <a href="#reviews" className="text-muted-foreground underline-offset-4 hover:underline">
                    ({ratingLabel(place.review_count)})
                  </a>
                </>
              ) : (
                <span className="text-muted-foreground">{t('placeDetail.noReviews')}</span>
              )}
            </dd>
          </div>
          {openNow !== null && (
            <div>
              <dt className="sr-only">{t('placeDetail.openingHours')}</dt>
              <dd
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium',
                  openNow ? 'bg-teal-soft text-primary' : 'bg-destructive/10 text-destructive'
                )}
              >
                <span aria-hidden className={cn('h-2 w-2 rounded-full', openNow ? 'bg-primary' : 'bg-destructive')} />
                {t(openNow ? 'placeDetail.openNow' : 'placeDetail.closedNow')}
              </dd>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-foreground">
            <dt className="sr-only">{t('placeDetail.entryFee')}</dt>
            <Ticket className="h-5 w-5 text-muted-foreground" aria-hidden />
            <dd className="font-medium">{place.price > 0 ? `฿${place.price}` : t('placeDetail.free')}</dd>
          </div>
          {place.address && (
            <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <dt className="sr-only">{t('placeDetail.location')}</dt>
              <MapPin className="h-5 w-5 shrink-0" aria-hidden />
              <dd className="truncate">{place.address}</dd>
            </div>
          )}
        </dl>
      </header>

      {/* Hero photo */}
      <div className="mx-auto mt-8 max-w-7xl px-4 sm:px-6">
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-teal-soft shadow-card sm:aspect-[16/9] lg:aspect-[21/9]">
          {place.image_url && !imageError ? (
            <img
              src={place.image_url}
              alt={displayName}
              className="h-full w-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-primary/40">
              <ImageOff className="h-16 w-16" aria-hidden />
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto mt-12 grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-14">
          {/* About */}
          {displayDescription && (
            <section aria-labelledby="about-heading">
              <h2 id="about-heading" className="sr-only">{t('placeDetail.about')}</h2>
              <p className="font-display text-2xl leading-relaxed text-foreground md:text-[1.7rem]">
                {displayDescription}
              </p>
            </section>
          )}

          {/* Opening hours */}
          <section aria-labelledby="hours-heading">
            <h2 id="hours-heading" className="font-display text-2xl font-semibold text-foreground">
              {t('placeDetail.openingHours')}
            </h2>
            {place.opening_hours.length > 0 ? (
              <ul className="mt-5 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {place.opening_hours.map((item) => {
                  const isToday = item.day_of_week === today;
                  return (
                    <li
                      key={item.day_of_week}
                      className={cn('flex items-center justify-between gap-4 px-5 py-3.5', isToday && 'bg-accent/50')}
                    >
                      <span className={cn('text-foreground', isToday && 'font-semibold')}>
                        {t(`placeDetail.days.${item.day_of_week}`)}
                        {isToday && (
                          <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                            {t('placeDetail.today')}
                          </span>
                        )}
                      </span>
                      <span className="text-right tabular-nums">
                        {item.is_closed ? (
                          <span className="font-medium text-destructive">{t('placeDetail.closed')}</span>
                        ) : (
                          <span className="font-medium text-foreground">
                            {formatTime(item.open_time)} – {formatTime(item.close_time)}
                          </span>
                        )}
                        {item.note && <span className="block text-xs text-muted-foreground">{item.note}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-4 rounded-2xl border border-dashed border-border px-5 py-4 text-muted-foreground">
                {t('placeDetail.noHours')}
              </p>
            )}
          </section>

          {/* Reviews */}
          <section id="reviews" aria-labelledby="reviews-heading" className="scroll-mt-24">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="reviews-heading" className="font-display text-2xl font-semibold text-foreground">
                {t('placeDetail.reviews')}
              </h2>
              {place.avg_rating !== null && (
                <div className="flex items-center gap-2">
                  <StarRow rating={place.avg_rating} />
                  <span className="font-semibold text-foreground">{place.avg_rating.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">({ratingLabel(place.review_count)})</span>
                </div>
              )}
            </div>

            {/* Review form */}
            {accessToken ? (
              <div className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-card">
                <p className="font-medium text-foreground">
                  {myReview ? t('placeDetail.editReview') : t('placeDetail.writeReview')}
                </p>
                <div className="-ml-2 mt-1" role="group" aria-label={t('placeDetail.selectRating')}>
                  <StarRow rating={draftRating} size="h-6 w-6" onSelect={setDraftRating} />
                </div>
                <label htmlFor="review-comment" className="sr-only">{t('placeDetail.yourReview')}</label>
                <Textarea
                  id="review-comment"
                  value={draftComment}
                  onChange={(e) => setDraftComment(e.target.value)}
                  placeholder={t('placeDetail.reviewPlaceholder')}
                  maxLength={2000}
                  className="mt-2 rounded-xl bg-background"
                  rows={3}
                />
                <div className="mt-3 flex justify-end gap-2">
                  {myReview && (
                    <Button
                      variant="ghost"
                      onClick={handleDeleteReview}
                      disabled={isReviewSaving}
                      className="h-11 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      {t('placeDetail.deleteReview')}
                    </Button>
                  )}
                  <Button onClick={handleSubmitReview} disabled={isReviewSaving} className="h-11 rounded-full px-6">
                    {isReviewSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                    {myReview ? t('placeDetail.updateReview') : t('placeDetail.submitReview')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4">
                <p className="text-muted-foreground">{t('placeDetail.beFirst')}</p>
                <Button asChild variant="secondary" className="h-11 rounded-full px-5">
                  <Link href="/auth/login">{t('placeDetail.loginToReview')}</Link>
                </Button>
              </div>
            )}

            {/* Review list */}
            {reviews.length > 0 ? (
              <ul className="mt-6 divide-y divide-border">
                {reviews.map((review) => (
                  <li key={review.id} className="py-5 first:pt-0">
                    <div className="flex items-center gap-3">
                      {review.author.avatar_url ? (
                        <img src={review.author.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-soft font-semibold text-primary">
                          {(review.author.nick_name || t('placeDetail.anonymous')).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">
                          {review.user_id === user?.id
                            ? t('placeDetail.you')
                            : review.author.nick_name || t('placeDetail.anonymous')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(review.created_at).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-GB')}
                        </p>
                      </div>
                      <StarRow rating={review.rating} size="h-4 w-4" />
                    </div>
                    {review.comment && (
                      <p className="mt-3 whitespace-pre-line leading-relaxed text-foreground">{review.comment}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              accessToken && <p className="mt-6 text-muted-foreground">{t('placeDetail.beFirst')}</p>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="font-display text-xl font-semibold text-foreground">{t('placeDetail.planVisit')}</h2>
            <div className="mt-5 space-y-3">
              <Button className="h-12 w-full rounded-full text-base" onClick={handleAddToTrip}>
                <Plus className="h-5 w-5" aria-hidden />
                {t('placeDetail.addToTrip')}
              </Button>
              <Button variant="secondary" className="h-12 w-full rounded-full text-base" onClick={handleAskAssistant}>
                <Sparkles className="h-5 w-5" aria-hidden />
                {t('placeDetail.askAssistant')}
              </Button>
            </div>

            <dl className="mt-6 space-y-4 border-t border-border pt-6 text-sm">
              <div className="flex items-start gap-3">
                <Ticket className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
                <div>
                  <dt className="text-muted-foreground">{t('placeDetail.entryFee')}</dt>
                  <dd className="font-medium text-foreground">{place.price > 0 ? `฿${place.price}` : t('placeDetail.free')}</dd>
                </div>
              </div>
              {place.suggested_duration_min ? (
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
                  <div>
                    <dt className="text-muted-foreground">{t('placeDetail.suggestedTime')}</dt>
                    <dd className="font-medium text-foreground">{formatDuration(place.suggested_duration_min)}</dd>
                  </div>
                </div>
              ) : null}
              {place.best_for.length > 0 && (
                <div className="flex items-start gap-3">
                  <Users className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
                  <div>
                    <dt className="text-muted-foreground">{t('placeDetail.bestFor')}</dt>
                    <dd className="font-medium text-foreground">{place.best_for.join(', ')}</dd>
                  </div>
                </div>
              )}
              {place.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
                  <div>
                    <dt className="text-muted-foreground">{t('placeDetail.contact')}</dt>
                    <dd>
                      <a href={`tel:${place.phone.replace(/[^\d+]/g, '')}`} className="font-medium text-foreground hover:text-primary">
                        {place.phone}
                      </a>
                    </dd>
                  </div>
                </div>
              )}
              {place.website && (
                <div className="flex items-start gap-3">
                  <Globe className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
                  <div>
                    <dt className="sr-only">{t('placeDetail.visitWebsite')}</dt>
                    <dd>
                      <a
                        href={place.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        {t('placeDetail.visitWebsite')}
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </a>
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          </div>

          {/* Location */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <button
              type="button"
              onClick={openInMaps}
              className="group relative block aspect-[4/3] w-full overflow-hidden bg-teal-soft"
              aria-label={t('placeDetail.openInMaps')}
            >
              {mapboxToken && (
                <img
                  src={`https://api.mapbox.com/styles/v1/mapbox/light-v11/static/pin-l+0e5a5f(${place.lng},${place.lat})/${place.lng},${place.lat},15,0/720x540@2x?access_token=${mapboxToken}`}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-card/95 px-3 py-1.5 text-sm font-medium text-foreground shadow-card">
                <ExternalLink className="h-4 w-4" aria-hidden />
                {t('placeDetail.openInMaps')}
              </span>
            </button>
            <div className="flex items-start justify-between gap-3 p-5">
              <div className="min-w-0">
                <h2 className="font-medium text-foreground">{t('placeDetail.location')}</h2>
                {place.address && <p className="mt-1 text-sm text-muted-foreground">{place.address}</p>}
                <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                  {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={openInMaps}
                className="h-11 shrink-0 rounded-full border-border px-4"
              >
                <Navigation className="h-4 w-4" aria-hidden />
                {t('placeDetail.directions')}
              </Button>
            </div>
          </div>
        </aside>
      </div>

      {/* Nearby */}
      {nearbyPlaces.length > 0 && (
        <section aria-labelledby="nearby-heading" className="mx-auto mt-20 max-w-7xl border-t border-border px-4 pt-14 sm:px-6">
          <div className="mb-8 flex items-end justify-between gap-4">
            <h2 id="nearby-heading" className="font-display text-3xl font-semibold tracking-tight text-foreground">
              {t('placeDetail.nearby')}
            </h2>
            <Link href="/places" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              {t('placeDetail.viewAll')}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {nearbyPlaces.map((nearby) => (
              <li key={nearby.id}>
                <Link href={`/places/${nearby.slug}`} className="group block">
                  <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-teal-soft">
                    {nearby.image_url ? (
                      <img
                        src={nearby.image_url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-primary/40">
                        <ImageOff className="h-8 w-8" aria-hidden />
                      </div>
                    )}
                  </div>
                  <h3 className="mt-3 font-display text-lg font-semibold leading-snug text-foreground group-hover:text-primary">
                    {(locale === 'th' && nearby.name_th) || nearby.name}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {typeof nearby.distance_km === 'number' && t('placeDetail.kmAway', { km: nearby.distance_km.toFixed(1) })}
                    {typeof nearby.distance_km === 'number' && nearby.tags.length > 0 && ' · '}
                    <span className="capitalize">{nearby.tags.slice(0, 2).map((tag) => tag.replace(/-/g, ' ')).join(', ')}</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
