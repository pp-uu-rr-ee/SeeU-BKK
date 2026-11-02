// Keys match place tags in bangkok_unseen; labels live in locales (stopCategory.*)
export const STOP_CATEGORIES = [
  "temple",
  "community",
  "museum",
  "park",
  "history",
  "market",
  "food",
  "art",
  "landmark",
  "nightlife",
  "shopping",
  "cafe",
  "restaurant",
  "place",
] as const;

export type StopCategory = (typeof STOP_CATEGORIES)[number];

export interface TripStop {
  id: string;
  placeId?: string;
  name: string;
  address: string;
  category: StopCategory;
  suggestedDurationMin: number;
  lat: number;
  lng: number;
  notes?: string;
  distanceFromPrevKm?: number;
  image_url?: string;
}

export interface Trip {
  id: string;
  name: string;
  date: string;
  totalDurationMin: number;
  totalDistanceKm: number;
  estimatedBudget: number;
  notes: string;
  stops: TripStop[];
  source?: "saved" | "draft";
  warnings?: string[];
}
