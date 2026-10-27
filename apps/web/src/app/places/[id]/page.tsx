"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { nameToSlug } from '@/lib/slug-utils';
import { formatTime, isOpenAt, type OpeningHour } from '@/lib/opening-hours';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/contexts/language-context';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import {
  MapPin,
  ArrowLeft,
  Clock,
  Star,
  Share2,
  Heart,
  Navigation,
  Camera,
  Users,
  Plus,
  ExternalLink,
  Phone,
  Globe,
  ChevronRight,
  MessageSquare,
  Loader2,
  Trash2,
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
          <Star className={`${size} ${filled ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
        );
        return onSelect ? (
          <button
            key={value}
            type="button"
            aria-label={`${value}`}
            onClick={() => onSelect(value)}
            className="p-0.5 rounded hover:scale-110 transition-transform"
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
      <div className="min-h-screen bg-gray-50">
        {/* Hero skeleton */}
        <div className="relative h-[50vh] bg-gray-200 animate-pulse">
          <div className="absolute bottom-8 left-8 right-8">
            <Skeleton className="h-10 w-2/3 mb-4" />
            <Skeleton className="h-6 w-1/3" />
          </div>
        </div>

        {/* Content skeleton */}
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-8 w-1/3 mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            </div>
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-1/2 mb-4" />
                  <Skeleton className="h-10 w-full mb-3" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !place) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <motion.div
          className="text-center p-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
            <MapPin className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('placeDetail.notFound')}</h2>
          <p className="text-gray-600 mb-6">{error || t('placeDetail.notFoundDesc')}</p>
          <Button
            onClick={() => router.back()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('placeDetail.back')}
          </Button>
        </motion.div>
      </div>
    );
  }

  const today = new Date().getDay();
  const hasContact = Boolean(place.phone || place.website);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <motion.div
        className="relative h-[50vh] min-h-[400px] bg-gradient-to-br from-blue-600 to-purple-700"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Background Image */}
        {place.image_url && !imageError ? (
          <img
            src={place.image_url}
            alt={displayName}
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Camera className="w-24 h-24 text-white/30" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />

        {/* Back button */}
        <motion.div
          className="absolute top-6 left-6"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Button
            onClick={() => router.back()}
            variant="ghost"
            size="icon"
            aria-label={t('placeDetail.back')}
            className="h-10 w-10 rounded-full bg-black/30 text-white hover:bg-black/50 hover:text-white backdrop-blur-sm"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          className="absolute top-6 right-6 flex gap-2"
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Button
            onClick={handleFavorite}
            disabled={isFavoriteSaving}
            variant="ghost"
            size="icon"
            aria-pressed={isFavorite}
            className={`h-10 w-10 rounded-full backdrop-blur-sm ${
              isFavorite
                ? 'bg-red-500 text-white hover:bg-red-600 hover:text-white'
                : 'bg-black/30 text-white hover:bg-black/50 hover:text-white'
            }`}
          >
            <Heart className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} />
          </Button>
          <Button
            onClick={handleShare}
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-black/30 text-white hover:bg-black/50 hover:text-white backdrop-blur-sm"
          >
            <Share2 className="h-5 w-5" />
          </Button>
        </motion.div>

        {/* Content overlay */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 p-8"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <div className="max-w-6xl mx-auto">
            {/* Tags */}
            {place.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {place.tags.map((tag, index) => (
                  <Badge
                    key={index}
                    className="bg-white/20 text-white backdrop-blur-sm border-0 hover:bg-white/30"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 drop-shadow-lg">
              {displayName}
            </h1>

            {/* Quick stats */}
            <div className="flex flex-wrap items-center gap-4 text-white/90">
              <div className="flex items-center gap-1.5">
                <Star className={`h-5 w-5 ${place.avg_rating !== null ? 'text-yellow-400 fill-current' : 'text-white/50'}`} />
                {place.avg_rating !== null ? (
                  <>
                    <span className="font-semibold">{place.avg_rating.toFixed(1)}</span>
                    <span className="text-white/70">({ratingLabel(place.review_count)})</span>
                  </>
                ) : (
                  <span className="text-white/70">{t('placeDetail.noReviews')}</span>
                )}
              </div>
              {place.address && (
                <>
                  <span className="text-white/50">•</span>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-5 w-5" />
                    <span>{place.address}</span>
                  </div>
                </>
              )}
              {openNow !== null && (
                <>
                  <span className="text-white/50">•</span>
                  <span className={openNow ? 'text-green-400 font-semibold' : 'text-red-300 font-semibold'}>
                    {t(openNow ? 'placeDetail.openNow' : 'placeDetail.closedNow')}
                  </span>
                </>
              )}
              {place.price > 0 && (
                <>
                  <span className="text-white/50">•</span>
                  <span className="text-green-400 font-semibold">฿{place.price}</span>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Content Section */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* About */}
            {displayDescription && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="overflow-hidden">
                  <CardContent className="p-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('placeDetail.about')}</h2>
                    <p className="text-gray-700 leading-relaxed text-lg">
                      {displayDescription}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Location */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="overflow-hidden">
                <CardContent className="p-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('placeDetail.location')}</h2>

                  {/* Map Preview */}
                  <div className="relative h-48 rounded-xl overflow-hidden mb-4 bg-gray-100">
                    <img
                      src={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+3b82f6(${place.lng},${place.lat})/${place.lng},${place.lat},15,0/600x300@2x?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`}
                      alt="Map preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/5 hover:bg-black/10 transition-colors cursor-pointer" onClick={openInMaps}>
                      <Button className="bg-white/90 text-gray-900 hover:bg-white shadow-lg">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        {t('placeDetail.openInMaps')}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      {place.address && <p className="text-gray-900 font-medium">{place.address}</p>}
                      <p className="text-sm text-gray-500 mt-1">
                        {place.lat.toFixed(6)}, {place.lng.toFixed(6)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Opening Hours */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <Card className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-gray-900">{t('placeDetail.openingHours')}</h2>
                    {openNow !== null && (
                      <Badge className={openNow ? 'bg-green-100 text-green-700 border-0' : 'bg-red-100 text-red-700 border-0'}>
                        {t(openNow ? 'placeDetail.openNow' : 'placeDetail.closedNow')}
                      </Badge>
                    )}
                  </div>
                  {place.opening_hours.length > 0 ? (
                    <div className="space-y-1">
                      {place.opening_hours.map((item) => (
                        <div
                          key={item.day_of_week}
                          className={`flex items-center justify-between py-2 px-2 -mx-2 rounded-md border-b border-gray-100 last:border-0 ${
                            item.day_of_week === today ? 'bg-blue-50' : ''
                          }`}
                        >
                          <span className={`text-gray-700 ${item.day_of_week === today ? 'font-semibold' : ''}`}>
                            {t(`placeDetail.days.${item.day_of_week}`)}
                            {item.day_of_week === today && (
                              <span className="ml-2 text-xs text-blue-600">{t('placeDetail.today')}</span>
                            )}
                          </span>
                          <span className="text-gray-900 font-medium text-right">
                            {item.is_closed
                              ? <span className="text-red-600">{t('placeDetail.closed')}</span>
                              : `${formatTime(item.open_time)} – ${formatTime(item.close_time)}`}
                            {item.note && <span className="block text-xs text-gray-500 font-normal">{item.note}</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">{t('placeDetail.noHours')}</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Reviews */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.65 }}
            >
              <Card className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-gray-900">{t('placeDetail.reviews')}</h2>
                    {place.avg_rating !== null && (
                      <div className="flex items-center gap-2">
                        <StarRow rating={place.avg_rating} />
                        <span className="font-semibold text-gray-900">{place.avg_rating.toFixed(1)}</span>
                        <span className="text-sm text-gray-500">({ratingLabel(place.review_count)})</span>
                      </div>
                    )}
                  </div>

                  {/* Review form */}
                  {accessToken ? (
                    <div className="rounded-xl border border-gray-200 p-4 mb-6">
                      <p className="text-sm font-medium text-gray-900 mb-2">
                        {myReview ? t('placeDetail.editReview') : t('placeDetail.writeReview')}
                      </p>
                      <StarRow rating={draftRating} size="h-6 w-6" onSelect={setDraftRating} />
                      <Textarea
                        value={draftComment}
                        onChange={(e) => setDraftComment(e.target.value)}
                        placeholder={t('placeDetail.reviewPlaceholder')}
                        maxLength={2000}
                        className="mt-3"
                        rows={3}
                      />
                      <div className="flex justify-end gap-2 mt-3">
                        {myReview && (
                          <Button variant="ghost" onClick={handleDeleteReview} disabled={isReviewSaving} className="text-red-600 hover:text-red-700">
                            <Trash2 className="w-4 h-4 mr-1" />
                            {t('placeDetail.deleteReview')}
                          </Button>
                        )}
                        <Button onClick={handleSubmitReview} disabled={isReviewSaving} className="bg-blue-600 hover:bg-blue-700">
                          {isReviewSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          {myReview ? t('placeDetail.updateReview') : t('placeDetail.submitReview')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline" className="mb-6" onClick={() => router.push('/auth/login')}>
                      {t('placeDetail.loginToReview')}
                    </Button>
                  )}

                  {/* Review list */}
                  {reviews.length > 0 ? (
                    <div className="space-y-4">
                      {reviews.map((review) => (
                        <div key={review.id} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                          <div className="flex items-center gap-3 mb-1">
                            {review.author.avatar_url ? (
                              <img src={review.author.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-semibold">
                                {(review.author.nick_name || t('placeDetail.anonymous')).charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">
                                {review.user_id === user?.id
                                  ? t('placeDetail.you')
                                  : review.author.nick_name || t('placeDetail.anonymous')}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(review.created_at).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-GB')}
                              </p>
                            </div>
                            <StarRow rating={review.rating} size="h-4 w-4" />
                          </div>
                          {review.comment && <p className="text-gray-700 mt-2 whitespace-pre-line">{review.comment}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">{t('placeDetail.beFirst')}</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Nearby Places */}
            {nearbyPlaces.length > 0 && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                <Card className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-2xl font-bold text-gray-900">{t('placeDetail.nearby')}</h2>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 hover:text-blue-700"
                        onClick={() => router.push('/places')}
                      >
                        {t('placeDetail.viewAll')}
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {nearbyPlaces.map((nearby, index) => (
                        <motion.div
                          key={nearby.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.1 * index }}
                          whileHover={{ scale: 1.02 }}
                          className="cursor-pointer"
                          onClick={() => router.push(`/places/${nearby.slug}`)}
                        >
                          <div className="group bg-white rounded-xl border hover:shadow-lg transition-all duration-200 overflow-hidden">
                            <div className="relative h-32 bg-gradient-to-br from-blue-100 to-purple-100">
                              {nearby.image_url ? (
                                <img
                                  src={nearby.image_url}
                                  alt={nearby.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Camera className="w-8 h-8 text-gray-400" />
                                </div>
                              )}
                            </div>
                            <div className="p-4">
                              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                {(locale === 'th' && nearby.name_th) || nearby.name}
                              </h3>
                              {typeof nearby.distance_km === 'number' && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {t('placeDetail.kmAway', { km: nearby.distance_km.toFixed(1) })}
                                </p>
                              )}
                              {nearby.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {nearby.tags.slice(0, 2).map((tag, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="sticky top-4"
            >
              <Card className="overflow-hidden">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">{t('placeDetail.planVisit')}</h2>
                  <div className="space-y-3">
                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium h-12"
                      onClick={handleAddToTrip}
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      {t('placeDetail.addToTrip')}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full h-12"
                      onClick={openInMaps}
                    >
                      <Navigation className="w-5 h-5 mr-2" />
                      {t('placeDetail.directions')}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full h-12"
                      onClick={handleAskAssistant}
                    >
                      <MessageSquare className="w-5 h-5 mr-2" />
                      {t('placeDetail.askAssistant')}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Info */}
              <Card className="overflow-hidden mt-6">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">{t('placeDetail.quickInfo')}</h2>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <span className="text-green-700 font-bold">฿</span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">{t('placeDetail.entryFee')}</p>
                        <p className="font-semibold text-gray-900">
                          {place.price > 0 ? `฿${place.price}` : t('placeDetail.free')}
                        </p>
                      </div>
                    </div>
                    {place.suggested_duration_min ? (
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Clock className="w-5 h-5 text-blue-700" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">{t('placeDetail.suggestedTime')}</p>
                          <p className="font-semibold text-gray-900">{formatDuration(place.suggested_duration_min)}</p>
                        </div>
                      </div>
                    ) : null}
                    {place.best_for.length > 0 && (
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                          <Users className="w-5 h-5 text-purple-700" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">{t('placeDetail.bestFor')}</p>
                          <p className="font-semibold text-gray-900">{place.best_for.join(', ')}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                        <Star className="w-5 h-5 text-yellow-700 fill-current" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">{t('placeDetail.rating')}</p>
                        <p className="font-semibold text-gray-900">
                          {place.avg_rating !== null
                            ? `${place.avg_rating.toFixed(1)} / 5`
                            : t('placeDetail.noReviews')}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Info */}
              {hasContact && (
                <Card className="overflow-hidden mt-6">
                  <CardContent className="p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">{t('placeDetail.contact')}</h2>
                    <div className="space-y-3">
                      {place.phone && (
                        <a
                          href={`tel:${place.phone.replace(/[^\d+]/g, '')}`}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <Phone className="w-5 h-5 text-gray-400" />
                          <span className="text-gray-700">{place.phone}</span>
                        </a>
                      )}
                      {place.website && (
                        <a
                          href={place.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <Globe className="w-5 h-5 text-gray-400" />
                          <span className="text-blue-600">{t('placeDetail.visitWebsite')}</span>
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
