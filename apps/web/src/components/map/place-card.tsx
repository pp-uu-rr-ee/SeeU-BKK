"use client";

import { useState, memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, Camera } from 'lucide-react';
import { motion } from 'motion/react';
import { formatRating, getRatingStars } from '@/lib/rating-utils';
import { useTranslation } from '@/contexts/language-context';

interface PlaceCardProps {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  image_url?: string;
  slug?: string;
  avgRating?: number | null;
  reviewCount?: number;
  onClick?: () => void;
  variant?: 'default' | 'compact';
  className?: string;
}

/**
 * PlaceCard - A rich preview card for displaying place information
 * 
 * Features:
 * - Lazy-loaded image with gradient fallback
 * - Average rating from user reviews (hidden until a place has reviews)
 * - Tags as badges
 * - Hover animations
 */
export const PlaceCard = memo(function PlaceCard({
  id,
  name,
  description,
  tags = [],
  image_url,
  avgRating = null,
  reviewCount = 0,
  onClick,
  variant = 'default',
  className = '',
}: PlaceCardProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const { t } = useTranslation();
  const rating = avgRating ?? 0;
  const { fullStars, halfStar, emptyStars } = getRatingStars(rating);

  const isCompact = variant === 'compact';

  // Render star icons
  const renderStars = () => {
    const stars = [];
    
    // Full stars
    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <Star 
          key={`full-${i}`} 
          className="h-3.5 w-3.5 text-saffron fill-current" 
        />
      );
    }
    
    // Half star
    if (halfStar) {
      stars.push(
        <div key="half" className="relative">
          <Star className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="absolute inset-0 overflow-hidden w-1/2">
            <Star className="h-3.5 w-3.5 text-saffron fill-current" />
          </div>
        </div>
      );
    }
    
    // Empty stars
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <Star 
          key={`empty-${i}`} 
          className="h-3.5 w-3.5 text-muted-foreground" 
        />
      );
    }
    
    return stars;
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={className}
    >
      <Card 
        className={`overflow-hidden cursor-pointer bg-card border-0 shadow-md hover:shadow-xl transition-shadow duration-300 ${
          isCompact ? 'h-auto' : ''
        }`}
        onClick={onClick}
      >
        {/* Image Section */}
        <div className={`relative bg-teal-soft ${
          isCompact ? 'h-24' : 'h-32'
        }`}>
          {image_url && !imageError ? (
            <>
              {/* Placeholder while loading */}
              {!imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Camera className="w-8 h-8 text-primary/40 animate-pulse" />
                </div>
              )}
              <img
                src={image_url}
                alt={name}
                loading="lazy"
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
            </>
          ) : (
            // Gradient placeholder with icon
            <div className="absolute inset-0 flex items-center justify-center">
              <Camera className="w-8 h-8 text-primary/40" />
            </div>
          )}
          
          {/* Subtle gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>

        <CardContent className={`${isCompact ? 'p-3' : 'p-4'}`}>
          {/* Place Name */}
          <h3 className={`font-semibold text-foreground leading-tight mb-1.5 line-clamp-1 ${
            isCompact ? 'text-sm' : 'text-base'
          }`}>
            {name}
          </h3>

          {/* Rating Row */}
          <div className="flex items-center gap-1.5 mb-2">
            {avgRating !== null ? (
              <>
                <div className="flex items-center gap-0.5">
                  {renderStars()}
                </div>
                <span className="text-sm font-medium text-foreground/80">
                  {formatRating(rating)}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({reviewCount})
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">{t('placeDetail.noReviews')}</span>
            )}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, isCompact ? 2 : 3).map((tag, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="text-xs px-1.5 py-0 bg-secondary text-muted-foreground hover:bg-secondary capitalize"
                >
                  {tag}
                </Badge>
              ))}
              {tags.length > (isCompact ? 2 : 3) && (
                <Badge
                  variant="outline"
                  className="text-xs px-1.5 py-0 text-muted-foreground border-border"
                >
                  +{tags.length - (isCompact ? 2 : 3)}
                </Badge>
              )}
            </div>
          )}

          {/* Description (only in default variant) */}
          {!isCompact && description && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
              {description}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
});

export default PlaceCard;
