"use client";

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, Heart, Share2, X, Camera } from 'lucide-react';
import { motion } from 'motion/react';
import type { Locale } from '@/contexts/language-context';

interface Place {
  id: string;
  name: string;
  description: string;
  tags: string[];
  lat: number;
  lng: number;
  address: string;
  price: number;
  image_url: string;
  slug: string;
}

interface PlacePopupContentProps {
  place: Place;
  onViewDetails: () => void;
  onGetDirections: () => void;
  onClose: () => void;
  userLocation?: [number, number] | null;
  authToken?: string;
  /** Passed in because the popup is rendered through createRoot, outside the language provider */
  t: (key: string, vars?: Record<string, string> | string) => string;
  locale: Locale;
}

const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000';

export const PlacePopupContent: React.FC<PlacePopupContentProps> = ({
  place,
  onViewDetails,
  onGetDirections,
  onClose,
  userLocation,
  authToken,
  t,
  locale,
}) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    setIsSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({
          title: place.name,
          text: place.description,
          url: `${window.location.origin}/places/${place.slug}`,
        });
      } else {
        await navigator.clipboard.writeText(
          `${window.location.origin}/places/${place.slug}`
        );
      }
    } catch (error) {
      // User cancelled or error
    } finally {
      setIsSharing(false);
    }
  };

  // Load whether this place is already a favorite
  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    fetch(`${serverUrl}/api/favorites`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (!cancelled && result?.success) setIsFavorite((result.placeIds || []).includes(place.id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authToken, place.id]);

  const handleFavorite = async () => {
    if (!authToken) {
      window.location.href = '/auth/login';
      return;
    }
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      const res = await fetch(`${serverUrl}/api/favorites/${place.id}`, {
        method: next ? 'PUT' : 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (error) {
      console.error('Error updating favorite:', error);
      setIsFavorite(!next);
      toast.error(t('mapPopup.favoriteFailed'));
    }
  };

  // Calculate distance if user location is available
  const calculateDistance = (): string | null => {
    if (!userLocation) return null;

    const R = 6371; // Earth's radius in km
    const dLat = ((place.lat - userLocation[1]) * Math.PI) / 180;
    const dLng = ((place.lng - userLocation[0]) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((userLocation[1] * Math.PI) / 180) *
        Math.cos((place.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    if (distance < 1) {
      return `${Math.round(distance * 1000)} m`;
    }
    return `${distance.toFixed(1)} km`;
  };

  const distance = calculateDistance();

  const normalizeImageUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return url;
    return `/${url}`;
  };

  const popupImageUrl = normalizeImageUrl(place.image_url);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <Card className="w-80 shadow-xl border-0 overflow-hidden bg-card">
        {/* Header Image */}
        <div className="relative h-36 bg-teal-soft">
          {popupImageUrl && !imageError ? (
            <img
              src={popupImageUrl}
              alt={place.name}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Camera className="w-12 h-12 text-primary/40" />
            </div>
          )}
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t('mapPopup.close')}
            className="absolute top-2 right-2 h-9 w-9 rounded-full bg-black/30 text-white hover:bg-black/50 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>

          {/* Favorite button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleFavorite}
            aria-label={t('mapPopup.saveFavorite')}
            aria-pressed={isFavorite}
            className={`absolute top-2 left-2 h-9 w-9 rounded-full ${
              isFavorite
                ? 'bg-destructive text-white hover:bg-destructive/90'
                : 'bg-black/30 text-white hover:bg-black/50'
            } hover:text-white`}
          >
            <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
          </Button>

          {/* Title and price overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="font-display text-white font-semibold text-xl leading-tight mb-1 drop-shadow-md">
              {place.name}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-saffron font-semibold text-sm drop-shadow-md">
                {place.price > 0 ? `฿${place.price.toLocaleString(locale === 'th' ? 'th-TH' : 'en-US')}` : t('mapPopup.free')}
              </span>
              {distance && (
                <>
                  <span className="text-white/50">•</span>
                  <span className="text-white/80 text-sm">{distance}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <CardContent className="p-4">
          {/* Tags */}
          {place.tags && place.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {place.tags.slice(0, 3).map((tag, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="text-xs px-2 py-0.5 bg-secondary text-foreground/80 hover:bg-secondary"
                >
                  {tag}
                </Badge>
              ))}
              {place.tags.length > 3 && (
                <Badge
                  variant="outline"
                  className="text-xs px-2 py-0.5 text-muted-foreground"
                >
                  +{place.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Description */}
          <p className="text-muted-foreground text-sm mb-4 line-clamp-2 leading-relaxed">
            {place.description.length > 100
              ? `${place.description.substring(0, 100)}...`
              : place.description}
          </p>

          {/* Address */}
          {place.address && (
            <div className="flex items-start gap-2 mb-4 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <span className="leading-tight line-clamp-2">{place.address}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              onClick={onViewDetails}
              className="flex-1 bg-primary hover:bg-primary/90 text-white font-medium"
              size="sm"
            >
              {t('mapPopup.viewDetails')}
            </Button>

            <Button
              onClick={onGetDirections}
              variant="outline"
              size="icon"
              className="flex-shrink-0"
              title={t('mapPopup.directions')}
              aria-label={t('mapPopup.directions')}
            >
              <Navigation className="h-4 w-4" />
            </Button>

            <Button
              onClick={handleShare}
              variant="outline"
              size="icon"
              className="flex-shrink-0"
              title={t('mapPopup.share')}
              aria-label={t('mapPopup.share')}
              disabled={isSharing}
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
