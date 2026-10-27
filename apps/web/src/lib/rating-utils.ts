/**
 * Rating display helpers for place cards (ratings come from place_reviews via the API)
 */

/**
 * Format a rating number for display.
 * 
 * @param rating - The rating to format
 * @returns A string with one decimal place (e.g., "4.2")
 */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/**
 * Get the number of full stars, half stars, and empty stars for a rating.
 * 
 * @param rating - The rating (0-5)
 * @returns An object with fullStars, halfStar (boolean), and emptyStars counts
 */
export function getRatingStars(rating: number): {
  fullStars: number;
  halfStar: boolean;
  emptyStars: number;
} {
  const clampedRating = Math.max(0, Math.min(5, rating));
  const fullStars = Math.floor(clampedRating);
  const hasHalfStar = clampedRating - fullStars >= 0.3 && clampedRating - fullStars < 0.8;
  const hasFullStar = clampedRating - fullStars >= 0.8;
  
  const actualFullStars = hasFullStar ? fullStars + 1 : fullStars;
  const halfStar = hasHalfStar;
  const emptyStars = 5 - actualFullStars - (halfStar ? 1 : 0);

  return {
    fullStars: actualFullStars,
    halfStar,
    emptyStars,
  };
}
