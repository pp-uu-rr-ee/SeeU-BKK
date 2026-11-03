"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { TripListColumn } from "@/components/planner/TripListColumn";
import { ItineraryColumn } from "@/components/planner/ItineraryColumn";
import { ChatPanel } from "@/components/planner/ChatPanel";
import { ChatHistorySidebar } from "@/components/planner/ChatHistorySidebar";
import MapContainer from "@/components/map/map-container";
import { CollapsiblePanel } from "@/components/map/collapsible-panel";
import { BottomSheet } from "@/components/map/bottom-sheet";
import { PlaceCard } from "@/components/map/place-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NewTripDialog } from "@/components/trips/new-trip-dialog";
import { EditTripDialog } from "@/components/trips/edit-trip-dialog";
import { AddTripStopDialog } from "@/components/trips/add-trip-stop-dialog";
import type { Trip, TripStop } from "@/types/trip";
import type { ChatPanelProps, TripDraft, TripDraftStop } from "@/components/planner/chat/types";
import { buildTripDraftSavePayload } from "@/components/planner/chat/lib/trip-draft";
import { nameToSlug } from "@/lib/slug-utils";
import { localizedPlace } from "@/lib/place-locale";
import { appendPlaceToTrip, mergeFetchedTrips, removeStop, restoreStop, toStopCategory, type TripPlaceCandidate } from "@/lib/trip-stop-utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

import {
  Search,
  X,
  Globe,
  Utensils,
  Landmark,
  Building2,
  ShoppingBag,
  TreePine,
  Camera,
  Music,
  Coffee,
  Loader2,
  Plus,
  MessageSquare,
  Map as MapIcon,
  List,
} from "lucide-react";

interface PlaceItem extends TripPlaceCandidate {
  lat?: number;
  lng?: number;
  tags?: string[];
  address?: string;
  image_url?: string;
  price?: number;
  avg_rating?: number | null;
  review_count?: number;
  name_th?: string | null;
  description_th?: string | null;
}

interface ChatSession {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: { title?: string };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

// Category definitions with icons (labels will use translations inside component)
const DEFAULT_CATEGORIES = [
  { id: 'all', key: 'nav.all', icon: Globe },
  { id: 'restaurant', key: 'categories.restaurants', icon: Utensils },
  { id: 'temple', key: 'categories.temples', icon: Landmark },
  { id: 'shopping', key: 'categories.shopping', icon: ShoppingBag },
  { id: 'park', key: 'categories.parks', icon: TreePine },
  { id: 'museum', key: 'categories.museums', icon: Building2 },
  { id: 'cafe', key: 'categories.cafes', icon: Coffee },
  { id: 'nightlife', key: 'categories.nightlife', icon: Music },
  { id: 'attraction', key: 'categories.attractions', icon: Camera },
];


import { useTranslation } from "@/contexts/language-context";
import { useAuth } from "@/contexts/auth-context";

export default function TripPlannerPage() {
  const { t, locale } = useTranslation();
  const { session, loading } = useAuth();
  const router = useRouter();
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";

  const [trips, setTrips] = useState<Trip[]>([]);
  // Saved trips edited here (add/remove/reorder stops) but not saved to the server yet
  const [unsavedTripIds, setUnsavedTripIds] = useState<Set<string>>(new Set());
  const unsavedTripIdsRef = useRef(unsavedTripIds);
  unsavedTripIdsRef.current = unsavedTripIds;
  const setTripUnsaved = useCallback((tripId: string, unsaved: boolean) => {
    setUnsavedTripIds((prev) => {
      if (prev.has(tripId) === unsaved) return prev;
      const next = new Set(prev);
      if (unsaved) next.add(tripId);
      else next.delete(tripId);
      return next;
    });
  }, []);

  // Warn before leaving the page with unsaved trip edits
  useEffect(() => {
    if (unsavedTripIds.size === 0) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [unsavedTripIds]);
  const [isTripsLoading, setIsTripsLoading] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<
    { lat: number; lng: number } | undefined
  >();
  const [foundPlaces, setFoundPlaces] = useState<PlaceItem[]>([]);
  const [initialPlaces, setInitialPlaces] = useState<PlaceItem[]>([]);
  const [activeTripDraft, setActiveTripDraft] = useState<TripDraft | null>(null);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PlaceItem[]>([]);
  const [visiblePlaces, setVisiblePlaces] = useState<PlaceItem[]>([]);

  // Panel visibility states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatPrefill, setChatPrefill] = useState<string | undefined>(undefined);
  const [pendingPlaceSlug, setPendingPlaceSlug] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<any | null>(null);
  // Mobile: start at peek height so the map (the page's main feature) is visible on arrival
  const [isBottomSheetExpanded, setIsBottomSheetExpanded] = useState(false);
  const [isNewTripDialogOpen, setIsNewTripDialogOpen] = useState(false);
  const [isAddStopDialogOpen, setIsAddStopDialogOpen] = useState(false);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | null>(null);
  const [routeTravelMin, setRouteTravelMin] = useState<number | null>(null);
  // Space the floating search bar + category chips cover at the top of the map
  const [searchOverlayEl, setSearchOverlayEl] = useState<HTMLDivElement | null>(null);
  const [mapTopInset, setMapTopInset] = useState(0);

  useEffect(() => {
    if (!searchOverlayEl) return;
    const measure = () => setMapTopInset(searchOverlayEl.offsetTop + searchOverlayEl.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(searchOverlayEl);
    return () => observer.disconnect();
  }, [searchOverlayEl]);

  // Left panel tab state
  const [leftPanelTab, setLeftPanelTab] = useState<'trips' | 'history'>('trips');

  // Chat session state
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);
  const [chatSessionMessages, setChatSessionMessages] = useState<
    ChatPanelProps["sessionMessages"]
  >(null);
  const hasActiveSearch = searchQuery.trim() || selectedCategory !== 'all';
  // Results list collapses to a pill once a place is picked, so the map and popup stay visible
  const [isResultsListOpen, setIsResultsListOpen] = useState(true);
  useEffect(() => {
    setIsResultsListOpen(true);
    // A new search takes over the camera from the previously opened place
    if (searchQuery.trim() || selectedCategory !== 'all') setSelectedPlace(null);
  }, [searchQuery, selectedCategory]);

  // Frame every search/category result on the map (not just the ones already in view)
  const resultsBounds = useMemo((): [[number, number], [number, number]] | null => {
    if (!hasActiveSearch) return null;
    const located = searchResults.filter((place) => typeof place.lat === 'number' && typeof place.lng === 'number');
    if (located.length === 0) return null;
    const lngs = located.map((place) => place.lng!);
    const lats = located.map((place) => place.lat!);
    return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
  }, [hasActiveSearch, searchResults]);

  const selectedTrip = trips.find((t) => t.id === selectedTripId) || null;
  const draftToTrip = useCallback((tripDraft: TripDraft): Trip => ({
    id: "draft",
    name: tripDraft.title,
    date: "",
    totalDurationMin: tripDraft.total_minutes,
    totalDistanceKm: tripDraft.total_distance_km,
    estimatedBudget: 0,
    notes: tripDraft.summary,
    source: "draft",
    warnings: tripDraft.warnings,
    stops: tripDraft.stops.map((stop) => {
      const place = tripDraft.places.find((item) => item.id === stop.place_id);
      return {
        id: stop.id,
        placeId: stop.place_id,
        name: stop.name,
        nameTh: initialPlaces.find((item) => item.id === stop.place_id)?.name_th ?? null,
        address: place?.address?.trim() || "",
        category: toStopCategory(place?.tags),
        suggestedDurationMin: stop.suggested_time_min,
        lat: stop.lat || 0,
        lng: stop.lng || 0,
        notes: stop.notes,
        distanceFromPrevKm: stop.distance_from_prev_km,
      };
    }),
  }), [initialPlaces]);
  const displayedTrip = useMemo(
    () => (activeTripDraft ? draftToTrip(activeTripDraft) : selectedTrip),
    [activeTripDraft, draftToTrip, selectedTrip]
  );

  const CATEGORIES = useMemo(() => DEFAULT_CATEGORIES.map(c => ({ ...c, label: t(c.key) })), [t]);

  useEffect(() => {
    if (!loading && !session?.access_token) {
      router.replace('/auth/login');
    }
  }, [loading, session, router]);

  // Fetch saved trips from server
  const fetchSavedTrips = useCallback(async () => {
    if (!session?.access_token) return;
    setIsTripsLoading(true);
    try {
      const response = await fetch(`${serverUrl}/api/itineraries`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await response.json()
        : { success: false, error: 'Bad response' };

      if (response.ok && data.success && Array.isArray(data.data)) {
        // Transform server trip data to match Trip interface
        const serverTrips = data.data.map((trip: any) => ({
          id: trip.id,
          name: trip.title || 'Unnamed Trip',
          // Formatted per locale in TripListColumn
          date: trip.created_at || '',
          stops: (trip.stops || []).map((stop: any) => ({
            id: stop.id,
            placeId: stop.place_id || stop.place?.id,
            name: stop.place?.name || 'Unknown Stop',
            nameTh: stop.place?.name_th ?? null,
            address: stop.place?.address?.trim() || '',
            category: toStopCategory(stop.place?.tags),
            suggestedDurationMin: stop.suggested_time_min || 60,
            lat: stop.place?.lat || 0,
            lng: stop.place?.lng || 0,
            notes: stop.notes || '',
            distanceFromPrevKm: stop.distance_from_prev_km || 0,
            image_url: stop.place?.image_url || '',
          })),
          totalDurationMin: trip.total_minutes || 0,
          totalDistanceKm: trip.total_distance_km || 0,
          estimatedBudget: 0,
          notes: '',
          source: 'saved',
        }));

        // Keep local versions of trips with unsaved edits (e.g. refetch after creating a trip)
        setTrips((prev) => mergeFetchedTrips(serverTrips, prev, unsavedTripIdsRef.current));
        if (serverTrips.length > 0 && !selectedTripId) {
          setSelectedTripId(serverTrips[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching saved trips:', error);
    } finally {
      setIsTripsLoading(false);
    }
  }, [session?.access_token, serverUrl, selectedTripId]);

  // Fetch chat sessions from server
  const fetchChatSessions = useCallback(async () => {
    if (!session?.access_token) return;
    setIsSessionsLoading(true);
    try {
      const response = await fetch(`${serverUrl}/api/sessions`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.sessions)) {
          setChatSessions(
            data.sessions.map((s: any) => ({
              id: s.id,
              createdAt: new Date(s.createdAt),
              updatedAt: new Date(s.updatedAt),
              metadata: s.metadata || {},
            }))
          );
        }
      }
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
    } finally {
      setIsSessionsLoading(false);
    }
  }, [session?.access_token, serverUrl]);

  // Fetch saved trips and chat sessions when user is authenticated
  useEffect(() => {
    if (session?.access_token) {
      fetchSavedTrips();
      fetchChatSessions();
    }
  }, [session?.access_token]);

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {
          // Silently fail - location is optional
        },
        { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 }
      );
    }
  }, []);

  // Deep links from place pages: /map?place=<slug> and /map?chat=true&about=<name>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const placeSlug = params.get('place');
    const about = params.get('about');
    if (placeSlug) setPendingPlaceSlug(placeSlug);
    if (params.get('chat') === 'true') {
      setIsChatOpen(true);
      if (about) setChatPrefill(t('map.askAboutPlace', { name: about }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch initial places on mount
  useEffect(() => {
    const fetchInitialPlaces = async () => {
      try {
        const response = await fetch(`${serverUrl}/api/places?limit=50`);

        if (!response.ok) {
          throw new Error("Failed to fetch initial places");
        }

        const data = await response.json();

        if (data.success && Array.isArray(data.data)) {
          setInitialPlaces(data.data.map((p: any) => ({
            id: p.id,
            name: p.name,
            slug: p.slug || p.id,
            lat: p.lat,
            lng: p.lng,
            tags: p.tags || [],
            price: p.price,
            description: p.description || '',
            name_th: p.name_th ?? null,
            description_th: p.description_th ?? null,
            address: p.address || p.name || 'Address not available',
            image_url: p.image_url || '',
            avg_rating: p.avg_rating ?? null,
            review_count: p.review_count ?? 0,
          })));
        }
      } catch (error) {
        console.error("Error fetching initial places:", error);
      }
    };

    fetchInitialPlaces();
  }, []);

  // Debounced search function
  const performSearch = useCallback(async (query: string, category: string) => {
    if (!query.trim() && category === 'all') {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const params = new URLSearchParams();

      if (query.trim()) {
        params.append('query', query);
      }
      if (category !== 'all') {
        params.append('categories', category);
      }
      params.append('limit', '20');
      params.append('locale', locale);

      const response = await fetch(`${serverUrl}/api/places?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        setSearchResults(data.data.map((p: any) => ({
          id: p.id,
          name: p.name,
          slug: p.slug || p.id,
          lat: p.lat,
          lng: p.lng,
          tags: p.tags || [],
          price: p.price,
          description: p.description || '',
          name_th: p.name_th ?? null,
          description_th: p.description_th ?? null,
          address: p.address || p.name || 'Address not available',
          image_url: p.image_url || '',
          avg_rating: p.avg_rating ?? null,
          review_count: p.review_count ?? 0,
        })));
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error(t("errors.searchFailed"));
    } finally {
      setIsSearching(false);
    }
  }, [locale, serverUrl, t]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery, selectedCategory);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory, performSearch]);

  const handlePlacesFound = (places: PlaceItem[]) => {
    setFoundPlaces(places);
  };

  const handleTripDraftCreated = useCallback((tripDraft: TripDraft) => {
    setActiveTripDraft(tripDraft);
  }, []);
  const handleClosePreview = useCallback(() => setActiveTripDraft(null), []);
  // Chat "Show on map" focuses the place like a search result
  const handleLocateChatPlace = useCallback((place: PlaceItem) => {
    const mapPlace = transformPlacesForMap([place])[0];
    if (!mapPlace) return;
    setSelectedPlace(mapPlace);
    // Phones: the trip sheet would cover the popup
    setIsBottomSheetExpanded(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Chat "Add" targets the selected saved trip; its stops show as "Added"
  const chatTripPlaceIds = useMemo(
    () => (selectedTrip?.stops ?? []).map((stop) => stop.placeId).filter((id): id is string => Boolean(id)),
    [selectedTrip]
  );

  const handleAddPlaceToTrip = useCallback((placesToAdd: PlaceItem | TripPlaceCandidate | Array<PlaceItem | TripPlaceCandidate>) => {
    const items = Array.isArray(placesToAdd) ? placesToAdd : [placesToAdd];
    setTrips((prevTrips) => {
      let updatedTrips = prevTrips;

      for (const place of items) {
        const result = appendPlaceToTrip({
          trips: updatedTrips,
          selectedTripId,
          place,
        });

        if (result.status === "missing-trip") {
          toast.error(t("errors.selectTrip"));
          return prevTrips;
        }

        if (result.status === "missing-location") {
          toast.error(t("errors.noLocation"));
          return prevTrips;
        }

        if (result.status === "duplicate") {
          toast.info(t("itinerary.alreadyInTrip", { name: place.name }));
          continue;
        }

        const addedMessage =
          t("actions.addedToTrip") || "{place} added to {trip}";
        const tripName = result.tripName || "this trip";
        toast.success(
          addedMessage
            .replace("{place}", place.name)
            .replace("{trip}", tripName)
        );

        updatedTrips = result.trips;
        if (selectedTripId) setTripUnsaved(selectedTripId, true);
      }

      return updatedTrips;
    });
  }, [selectedTripId, t, setTripUnsaved]);

  // Popup shortcut to add the opened place to the saved trip shown in the itinerary panel
  const popupAddToTrip = useMemo(() => {
    if (activeTripDraft || leftPanelTab !== 'trips' || !selectedTrip) return null;
    return {
      label: t("map.popup.addToTrip", { trip: selectedTrip.name }),
      placeIds: selectedTrip.stops.map((stop) => stop.placeId).filter((id): id is string => Boolean(id)),
      onAdd: (place: { id: string; name: string; slug: string; lat: number; lng: number; tags: string[]; description?: string; address?: string }) =>
        handleAddPlaceToTrip(place),
    };
  }, [activeTripDraft, leftPanelTab, selectedTrip, t, handleAddPlaceToTrip]);

  const handleNewTrip = () => {
    setIsNewTripDialogOpen(true);
  };

  const handleNewTripSuccess = () => {
    // Refetch trips from the server
    fetchSavedTrips();
    setIsNewTripDialogOpen(false);
  };

  const handleOpenAddStopDialog = useCallback((tripId: string) => {
    setSelectedTripId(tripId);
    setIsAddStopDialogOpen(true);
  }, []);

  const handleDeleteStop = useCallback((tripId: string, stopId: string) => {
    if (tripId === "draft" && activeTripDraft) {
      const index = activeTripDraft.stops.findIndex((s) => s.id === stopId);
      const removed = activeTripDraft.stops[index];
      if (!removed) return;
      setActiveTripDraft({
        ...activeTripDraft,
        stops: activeTripDraft.stops.filter((s) => s.id !== stopId),
      });
      toast.success(t("itinerary.stopRemoved", { name: removed.name }), {
        action: {
          label: t("itinerary.undo"),
          onClick: () =>
            setActiveTripDraft((draft) => {
              if (!draft || draft.stops.some((s) => s.id === removed.id)) return draft;
              const stops = [...draft.stops];
              stops.splice(Math.min(index, stops.length), 0, removed);
              return { ...draft, stops };
            }),
        },
      });
      return;
    }

    const { trips: nextTrips, removed } = removeStop(trips, tripId, stopId);
    if (!removed) return;
    setTrips(nextTrips);
    setTripUnsaved(tripId, true);
    toast.success(t("itinerary.stopRemoved", { name: removed.stop.name }), {
      action: {
        label: t("itinerary.undo"),
        onClick: () => setTrips((prev) => restoreStop(prev, tripId, removed.stop, removed.index)),
      },
    });
  }, [activeTripDraft, trips, t, setTripUnsaved]);

  // Map/popup shape for a trip stop, filled from the loaded place (real description,
  // Thai fields, photo, slug for "View details")
  const stopToMapPlace = (stop: TripStop) => {
    const place = initialPlaces.find((item) => item.id === stop.placeId);
    return {
      id: stop.id,
      name: stop.name,
      name_th: stop.nameTh ?? place?.name_th ?? null,
      description: place?.description || t(`stopCategory.${stop.category}`),
      description_th: place?.description_th ?? null,
      tags: place?.tags?.length ? place.tags : [stop.category],
      lat: stop.lat,
      lng: stop.lng,
      address: stop.address,
      price: place?.price ?? 0,
      image_url: stop.image_url || place?.image_url || "",
      slug: place?.slug || nameToSlug(stop.name),
    };
  };

  const handleSelectStop = useCallback((stop: TripStop) => {
    setSelectedPlace(stopToMapPlace(stop));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, initialPlaces]);

  const handleDeleteTrip = async (tripId: string) => {
    if (!confirm(t("tripList.deleteConfirm"))) return;
    if (session?.access_token) {
      try {
        await fetch(`${serverUrl}/api/itineraries/${tripId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      } catch {
        toast.error(t("tripList.deleteFailed"));
        return;
      }
    }
    setTrips((prev) => prev.filter((t) => t.id !== tripId));
    setTripUnsaved(tripId, false);
    if (tripId === selectedTripId) {
      const remaining = trips.filter((t) => t.id !== tripId);
      setSelectedTripId(remaining[0]?.id || null);
    }
  };

  const handleEditTrip = (tripId: string) => {
    const trip = trips.find(t => t.id === tripId);
    if (trip) {
      setEditingTrip(trip);
    }
  };

  const handleReorderTrips = (orderedTripIds: string[]) => {
    setTrips((prev) => {
      const idToTrip = new Map(prev.map((t) => [t.id, t] as const));
      const reordered: Trip[] = [];
      for (const id of orderedTripIds) {
        const tr = idToTrip.get(id);
        if (tr) reordered.push(tr);
      }
      for (const t of prev)
        if (!orderedTripIds.includes(t.id)) reordered.push(t);
      return reordered;
    });
  };

  const handleReorderStops = (tripId: string, orderedStopIds: string[]) => {
    if (tripId === "draft" && activeTripDraft) {
      const idToStop = new Map(activeTripDraft.stops.map((stop) => [stop.id, stop] as const));
      const reordered = orderedStopIds
        .map((id) => idToStop.get(id))
        .filter((stop): stop is TripDraftStop => Boolean(stop));
      const remainder = activeTripDraft.stops.filter((stop) => !orderedStopIds.includes(stop.id));
      setActiveTripDraft({
        ...activeTripDraft,
        stops: [...reordered, ...remainder],
      });
      return;
    }
    setTrips((prev) =>
      prev.map((t) => {
        if (t.id !== tripId) return t;
        const idToStop = new Map(t.stops.map((s) => [s.id, s] as const));
        const reordered: TripStop[] = [];
        for (const id of orderedStopIds) {
          const st = idToStop.get(id);
          if (st) reordered.push(st);
        }
        for (const s of t.stops)
          if (!orderedStopIds.includes(s.id)) reordered.push(s);
        const newDuration = reordered.reduce(
          (sum, s) => sum + s.suggestedDurationMin,
          0
        );
        return { ...t, stops: reordered, totalDurationMin: newDuration };
      })
    );
    setTripUnsaved(tripId, true);
  };

  const handleSaveTripToServer = useCallback(async (tripId: string, orderedStops: TripStop[]) => {
    if (!session?.access_token) {
      toast.error(t("itinerary.loginToSave"));
      return;
    }
    try {
      const isDraftSave = tripId === "draft" && activeTripDraft;
      const trip = isDraftSave ? displayedTrip : trips.find(t => t.id === tripId);
      if (!trip) return;

      const res = await fetch(`${serverUrl}/api/itineraries${isDraftSave ? "" : `/${tripId}`}`, {
        method: isDraftSave ? "POST" : "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(
          isDraftSave && activeTripDraft
            ? buildTripDraftSavePayload({
                ...activeTripDraft,
                stops: activeTripDraft.stops.map((stop) => {
                  const orderedStop = orderedStops.find((item) => item.id === stop.id);
                  return orderedStop
                    ? {
                        ...stop,
                        suggested_time_min: orderedStop.suggestedDurationMin,
                      }
                    : stop;
                }),
              })
            : {
                title: trip.name,
                total_minutes: trip.totalDurationMin,
                total_distance_km: trip.totalDistanceKm,
                stops: orderedStops.map(s => ({
                  ...(isUuid(s.placeId) ? { place_id: s.placeId } : { slug: nameToSlug(s.name) }),
                  suggested_time_min: s.suggestedDurationMin,
                  notes: s.notes ?? "",
                  distance_from_prev_km: s.distanceFromPrevKm,
                })),
              }
        ),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? `Error ${res.status}`);
      toast.success(isDraftSave ? t("itinerary.draftSaved") : t("itinerary.tripSaved"));
      if (!isDraftSave) setTripUnsaved(tripId, false);
      if (isDraftSave) {
        setActiveTripDraft(null);
        if (data.data?.id) {
          setSelectedTripId(data.data.id);
        }
      }
      fetchSavedTrips();
    } catch (e: any) {
      toast.error(e.message ?? t("itinerary.saveFailed"));
    }
  }, [session?.access_token, serverUrl, trips, fetchSavedTrips, activeTripDraft, displayedTrip, setTripUnsaved]);

  const handleClearSearch = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSearchResults([]);
  };

  // Chat session handlers
  const handleSelectSession = useCallback(async (sessionId: string) => {
    if (!session?.access_token) return;
    try {
      const response = await fetch(`${serverUrl}/api/sessions/${sessionId}/messages`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.messages)) {
          setActiveSessionId(sessionId);
          setChatSessionMessages(data.messages);
          setIsChatOpen(true);
        }
      }
    } catch (error) {
      console.error('Error loading session messages:', error);
      toast.error(t("chatHistory.loadFailed"));
    }
  }, [session?.access_token, serverUrl]);

  const [chatResetKey, setChatResetKey] = useState(0);
  const handleNewSession = useCallback(() => {
    setActiveSessionId(null);
    setChatSessionMessages(null);
    setChatResetKey((key) => key + 1);
  }, []);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    if (!session?.access_token) return;
    try {
      const response = await fetch(`${serverUrl}/api/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.ok) {
        setChatSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (activeSessionId === sessionId) {
          setActiveSessionId(null);
          setChatSessionMessages(null);
          setChatResetKey((key) => key + 1);
        }
        toast.success(t("chatHistory.deleted"));
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error(t("chatHistory.deleteFailed"));
    }
  }, [activeSessionId, session?.access_token, serverUrl]);

  const handleSessionCreated = useCallback((id: string | null) => {
    setActiveSessionId(id);
    // Refresh session list after a short delay to allow backend to save
    if (id) {
      setTimeout(() => {
        fetchChatSessions();
      }, 1500);
    }
  }, [fetchChatSessions]);

  // Transform places for map display
  const transformPlacesForMap = (places: PlaceItem[]): any[] => {
    return places
      .filter((place) => place.lat && place.lng)
      .map((place) => ({
        id: place.id,
        name: place.name,
        name_th: place.name_th ?? null,
        description: place.description || place.tags?.join(", ") || "",
        description_th: place.description_th ?? null,
        tags: place.tags || [],
        lat: place.lat!,
        lng: place.lng!,
        address: place.address || "",
        price: place.price || 0,
        image_url: place.image_url || "",
        slug: place.slug || place.id,
      }));
  };

  // Select the deep-linked place once the initial list is available
  useEffect(() => {
    if (!pendingPlaceSlug || initialPlaces.length === 0) return;
    const slug = pendingPlaceSlug;
    setPendingPlaceSlug(null);

    const select = (place: PlaceItem) => {
      const mapPlace = transformPlacesForMap([place])[0];
      if (mapPlace) setSelectedPlace(mapPlace);
    };
    const known = initialPlaces.find((p) => p.slug === slug);
    if (known) {
      select(known);
      return;
    }
    fetch(`${serverUrl}/api/places/${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (result?.success && result.data) select(result.data);
      })
      .catch((error) => console.error('Error loading linked place:', error));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPlaceSlug, initialPlaces, serverUrl]);

  const transformTripStopsForMap = (trip: Trip | null): any[] => {
    if (!trip || !trip.stops) return [];
    return trip.stops
      .map((stop, index) => ({ stop, sequence: index + 1 }))
      .filter(({ stop }) => stop.lat && stop.lng)
      .map(({ stop, sequence }) => ({ sequence, ...stopToMapPlace(stop) }));
  };

  const transformTripDraftStopsForMap = (stops: TripDraftStop[]): any[] => {
    return stops
      .filter((stop) => stop.lat && stop.lng)
      .map((stop) => ({
        id: `itinerary-${stop.slug}`,
        name: stop.name,
        description: stop.notes || "Itinerary stop",
        tags: [],
        lat: stop.lat!,
        lng: stop.lng!,
        address: stop.slug,
        price: 0,
        image_url: (stop as any).image_url || "",
        slug: stop.slug,
      }));
  };

  const enrichedTripDraft = useMemo(() => {
    if (!activeTripDraft) return null;

    return {
      ...activeTripDraft,
      stops: activeTripDraft.stops.map((stop) => {
        // Try to find the location details in our loaded places
        const place =
          foundPlaces.find((p) => p.name === stop.name || p.id === stop.place_id || p.slug === stop.slug) ||
          initialPlaces.find((p) => p.name === stop.name || p.id === stop.place_id || p.slug === stop.slug) ||
          searchResults.find((p) => p.name === stop.name || p.id === stop.place_id || p.slug === stop.slug);

        return {
          ...stop,
          lat: place?.lat ?? stop.lat,
          lng: place?.lng ?? stop.lng,
          slug: place?.slug ?? stop.slug ?? stop.name,
          image_url: place?.image_url ?? "",
        };
      })
    };
  }, [activeTripDraft, foundPlaces, initialPlaces, searchResults]);

  const tripDraftStopsForMap = useMemo(
    () => enrichedTripDraft?.stops
      ? transformTripDraftStopsForMap(enrichedTripDraft.stops)
      : [],
    [enrichedTripDraft]
  );

  const allPlacesForMap = useMemo(() => {
    if (enrichedTripDraft) {
      return tripDraftStopsForMap;
    }

    // In Trips tab: a selected trip focuses the map on its numbered stops, plus any
    // active search/category results so the user can find places to add.
    // If no trip is selected (unfocused), show all pins.
    if (leftPanelTab === 'trips' && selectedTrip) {
      const stopPlaceIds = new Set(selectedTrip.stops.map((stop) => stop.placeId));
      const results = hasActiveSearch
        ? searchResults.filter((place) => !stopPlaceIds.has(place.id))
        : [];
      return [
        ...transformPlacesForMap(results),
        ...transformTripStopsForMap(selectedTrip),
      ];
    }

    const placesToShow = hasActiveSearch ? searchResults : initialPlaces;

    return [
      ...transformPlacesForMap(foundPlaces),
      ...transformPlacesForMap(placesToShow),
      ...transformTripStopsForMap(selectedTrip),
    ];
  }, [foundPlaces, searchResults, initialPlaces, searchQuery, selectedCategory, selectedTrip, enrichedTripDraft, tripDraftStopsForMap, leftPanelTab]);

  // Context places that can be shared with chat (only map-visible place set)
  const chatContextPlaces = useMemo(
    () => visiblePlaces.slice(0, 20).map((p) => ({ id: p.id, name: p.name, slug: p.slug, tags: p.tags })),
    [visiblePlaces]
  );

  // Generate trip route coordinates from selected trip stops
  const tripRoute = useMemo(() => {
    if (enrichedTripDraft) {
      return [];
    }

    if (!displayedTrip || !displayedTrip.stops || displayedTrip.stops.length < 2) {
      return [];
    }
    return displayedTrip.stops
      .filter((stop) => stop.lat && stop.lng)
      .map((stop) => [stop.lng, stop.lat] as [number, number]);
  }, [displayedTrip, enrichedTripDraft]);

  const stopsSuggestedDuration = useMemo(() => {
    if (!displayedTrip || !displayedTrip.stops) return 0;
    return displayedTrip.stops.reduce((sum, s) => sum + (s.suggestedDurationMin || 0), 0);
  }, [displayedTrip]);

  // Early return must come after all hooks to keep hook order stable
  if (!loading && !session?.access_token) {
    return null;
  }

  return (
    // Fill the viewport below the sticky site header (h-16 + 1px border) so the page never scrolls
    <div className="relative w-full h-[calc(100dvh-4rem-1px)] overflow-hidden">
      {/* Fullscreen Map Background - reserve space for side panels on md+ */}
      <div className="absolute inset-0 z-0 md:left-[400px] md:right-[400px]">
        <MapContainer
          places={allPlacesForMap}
          selectedPlace={selectedPlace}
          onPlaceSelect={setSelectedPlace}
          onPlaceDeselect={() => setSelectedPlace(null)}
          onVisiblePlacesChange={setVisiblePlaces}
          userLocation={
            userLocation ? [userLocation.lng, userLocation.lat] : undefined
          }
          initialCenter={[100.5018, 13.7563]}
          initialZoom={12}
          previewItinerary={enrichedTripDraft}
          tripRoute={tripRoute}
          topInset={mapTopInset}
          fitBounds={resultsBounds}
          addToTrip={popupAddToTrip}
          onRouteInfo={({ distanceKm, durationMin }) => {
            setRouteDistanceKm(distanceKm);
            setRouteTravelMin(durationMin);
          }}
        />
      </div>

      {/* Perplexity-style Search Bar */}
      <motion.div
        ref={setSearchOverlayEl}
        className="absolute top-4 left-4 right-4 z-20 md:left-[400px] md:right-[400px] md:mx-auto md:w-[600px]"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="absolute left-4 text-muted-foreground h-5 w-5 pointer-events-none" />
            <Input
              type="text"
              placeholder={t("map.searchPlaceholder")}
              aria-label={t("map.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-12 h-12 rounded-full shadow-xl border-0 bg-card/95 backdrop-blur-md text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
            {(searchQuery || selectedCategory !== 'all') && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearSearch}
                className="absolute right-1 h-10 w-10 rounded-full hover:bg-secondary"
                aria-label={t("map.results.clear")}
              >
                <X className="h-4 w-4 text-muted-foreground" aria-hidden />
              </Button>
            )}
            {isSearching && (
              <Loader2 className="absolute right-12 h-5 w-5 text-primary animate-spin" />
            )}
          </div>
        </div>

        {/* Category Filters - Perplexity style */}
        {/* Edge fade hints that more categories scroll in from the right */}
        <motion.div
          className="mt-3 flex gap-2 overflow-x-auto pb-2 pr-8 scrollbar-hide [mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)]"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          {CATEGORIES.map((category) => {
            const Icon = category.icon;
            const isSelected = selectedCategory === category.id;

            return (
              <Button
                key={category.id}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                aria-pressed={isSelected}
                className={`flex items-center gap-2 whitespace-nowrap rounded-full transition-all max-md:h-11 ${isSelected
                  ? 'bg-primary hover:bg-primary/90 text-white shadow-md'
                  : 'bg-card/95 backdrop-blur-md hover:bg-secondary border-0 shadow-md'
                  }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {category.label}
              </Button>
            );
          })}
        </motion.div>

        {/* Search Results Dropdown */}
        <AnimatePresence>
          {searchResults.length > 0 && hasActiveSearch && !isResultsListOpen && (
            <motion.div
              key="results-pill"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-[calc(100%+0.75rem)] left-0"
            >
              <Button
                variant="secondary"
                onClick={() => setIsResultsListOpen(true)}
                className="h-11 rounded-full bg-card/95 px-4 shadow-xl backdrop-blur-md"
                aria-expanded={false}
              >
                <List className="h-4 w-4" aria-hidden />
                {t("map.results.showList", { count: String(searchResults.length) })}
              </Button>
            </motion.div>
          )}
          {searchResults.length > 0 && hasActiveSearch && isResultsListOpen && (
            <motion.div
              key="results-list"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-[calc(100%+0.75rem)] left-0 right-0 mt-0 overflow-hidden rounded-2xl bg-card/95 shadow-xl backdrop-blur-md max-h-[min(48vh,420px)] overflow-y-auto md:max-h-[420px]"
            >
              <div className="p-3 sm:p-4">
                <div className="px-1 py-1 text-sm text-muted-foreground flex items-center justify-between gap-3">
                  <span role="status">{t("map.results.found", { count: String(searchResults.length) })}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsResultsListOpen(false)}
                      className="h-11 rounded-full text-muted-foreground hover:text-foreground"
                      aria-expanded={true}
                    >
                      {t("map.results.hideList")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearSearch}
                      className="h-11 rounded-full text-muted-foreground hover:text-foreground"
                    >
                      {t("map.results.clear")}
                    </Button>
                  </div>
                </div>

                {/* Search results adapt from single column on mobile to grid on desktop */}
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {searchResults.slice(0, 6).map((place, index) => (
                    <motion.div
                      key={place.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="relative group"
                    >
                      <PlaceCard
                        id={place.id}
                        name={localizedPlace(place, locale).name}
                        tags={place.tags}
                        image_url={place.image_url}
                        avgRating={place.avg_rating ?? null}
                        reviewCount={place.review_count ?? 0}
                        variant="compact"
                        onClick={() => {
                          const mapPlace = transformPlacesForMap([place])[0];
                          if (mapPlace) {
                            setSelectedPlace(mapPlace);
                            setIsResultsListOpen(false);
                          }
                        }}
                      />
                      {/* Add to Trip Button Overlay */}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddPlaceToTrip(place);
                        }}
                        className="absolute top-2 right-2 h-11 w-11 rounded-full p-0 bg-card/95 hover:bg-white shadow-md"
                        title={t("map.results.addToTrip")}
                        aria-label={t("map.results.addPlaceToTrip", { name: place.name })}
                      >
                        <Plus className="h-4 w-4 text-primary" aria-hidden />
                      </Button>
                    </motion.div>
                  ))}
                </div>

                {/* Show more results if available */}
                {searchResults.length > 6 && (
                  <div className="mt-3 text-center">
                    <span className="text-sm text-muted-foreground">
                      {t("map.results.moreOnMap", { count: String(searchResults.length - 6) })}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Left Panel - Trip List & Chat History (Desktop Only) */}
      <div className="hidden md:block">
        <CollapsiblePanel
          isOpen={isLeftPanelOpen}
          onClose={() => setIsLeftPanelOpen(false)}
          position="left"
          title={leftPanelTab === 'trips' ? t("tripList.title") : t("chatHistory.title")}
          width="w-[400px]"
        >
          {/* Tab switcher */}
          <div className="flex gap-1 mb-4 p-1 bg-secondary rounded-lg">
            <button
              onClick={() => setLeftPanelTab('trips')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${leftPanelTab === 'trips'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <MapIcon className="h-4 w-4" aria-hidden />
              {t("tripList.title")}
            </button>
            <button
              onClick={() => {
                setLeftPanelTab('history');
                fetchChatSessions();
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${leftPanelTab === 'history'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <MessageSquare className="h-4 w-4" aria-hidden />
              {t("chatHistory.title")}
            </button>
          </div>

          {leftPanelTab === 'trips' ? (
            <TripListColumn
              trips={trips}
              selectedTripId={selectedTripId}
              onSelectTrip={(tripId) => {
                setSelectedTripId(tripId);
                setActiveTripDraft(null);
              }}
              onNewTripClick={handleNewTrip}
              onDeleteTrip={handleDeleteTrip}
              onEditTrip={handleEditTrip}
              onReorderTrips={handleReorderTrips}
            />
          ) : (
            <ChatHistorySidebar
              sessions={chatSessions}
              activeSessionId={activeSessionId}
              onSelectSession={handleSelectSession}
              onNewSession={handleNewSession}
              onDeleteSession={handleDeleteSession}
              isLoading={isSessionsLoading}
            />
          )}
        </CollapsiblePanel>
      </div>

      {/* Right Panel - Itinerary (Desktop Only) */}
      <div className="hidden md:block">
        <CollapsiblePanel
          isOpen={isRightPanelOpen}
          onClose={() => setIsRightPanelOpen(false)}
          position="right"
          title={displayedTrip?.name || "Itinerary"}
          width="w-[400px]"
        >
          <ItineraryColumn
            trip={displayedTrip}
            onEditTrip={displayedTrip?.source === "draft" ? undefined : handleEditTrip}
            onAddStop={displayedTrip?.source === "saved" ? handleOpenAddStopDialog : undefined}
            onDeleteStop={handleDeleteStop}
            onSelectStop={handleSelectStop}
            onSaveTrip={handleSaveTripToServer}
            onReorderStops={handleReorderStops}
            isLoading={isTripsLoading}
            totalDurationMin={(stopsSuggestedDuration || 0) + (routeTravelMin || 0)}
            totalDistanceKm={routeDistanceKm ?? displayedTrip?.totalDistanceKm ?? 0}
            mode={displayedTrip?.source === "draft" ? "draft" : "saved"}
            hasUnsavedChanges={!!displayedTrip && unsavedTripIds.has(displayedTrip.id)}
            onClosePreview={() => setActiveTripDraft(null)}
            warnings={displayedTrip?.warnings ?? []}
          />
        </CollapsiblePanel>
      </div>

      {/* Bottom Sheet - Trip & Itinerary (Mobile Only) - Always Visible */}
      <BottomSheet
        isOpen={isBottomSheetExpanded}
        onClose={() => setIsBottomSheetExpanded(false)}
        onOpenChange={setIsBottomSheetExpanded}
        title={leftPanelTab === 'history' ? t("chatHistory.title") : displayedTrip?.name || t("tripList.title")}
        peekHeight={120}
      >
        <div className="px-4 space-y-6">
          <div className="flex gap-1 mb-4 p-1 bg-secondary rounded-lg">
            <button
              onClick={() => setLeftPanelTab('trips')}
              className={`flex-1 flex items-center justify-center gap-2 min-h-11 py-2 px-3 rounded-md text-sm font-medium transition-colors ${leftPanelTab === 'trips'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <MapIcon className="h-4 w-4" aria-hidden />
              {t("tripList.title")}
            </button>
            <button
              onClick={() => {
                setLeftPanelTab('history');
                fetchChatSessions();
              }}
              className={`flex-1 flex items-center justify-center gap-2 min-h-11 py-2 px-3 rounded-md text-sm font-medium transition-colors ${leftPanelTab === 'history'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <MessageSquare className="h-4 w-4" aria-hidden />
              {t("chatHistory.title")}
            </button>
          </div>

          {leftPanelTab === 'trips' ? (
            <div className="space-y-6">
              <div>
                <TripListColumn
                  trips={trips}
                  selectedTripId={selectedTripId}
                  onSelectTrip={(tripId) => {
                    setSelectedTripId(tripId);
                    setActiveTripDraft(null);
                  }}
                  onNewTripClick={handleNewTrip}
                  onDeleteTrip={handleDeleteTrip}
                  onEditTrip={handleEditTrip}
                  onReorderTrips={handleReorderTrips}
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground/80 mb-3">
                  {t("itinerary.heading")}
                </h3>
                <ItineraryColumn
                  trip={displayedTrip}
                  onEditTrip={displayedTrip?.source === "draft" ? undefined : handleEditTrip}
                  onAddStop={displayedTrip?.source === "saved" ? handleOpenAddStopDialog : undefined}
                  onDeleteStop={handleDeleteStop}
                  onSelectStop={handleSelectStop}
                  onSaveTrip={handleSaveTripToServer}
                  onReorderStops={handleReorderStops}
                  isLoading={isTripsLoading}
                  totalDurationMin={(stopsSuggestedDuration || 0) + (routeTravelMin || 0)}
                  totalDistanceKm={routeDistanceKm ?? displayedTrip?.totalDistanceKm ?? 0}
                  mode={displayedTrip?.source === "draft" ? "draft" : "saved"}
            hasUnsavedChanges={!!displayedTrip && unsavedTripIds.has(displayedTrip.id)}
            onClosePreview={() => setActiveTripDraft(null)}
                  warnings={displayedTrip?.warnings ?? []}
                />
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[60vh]">
              <ChatHistorySidebar
                sessions={chatSessions}
                activeSessionId={activeSessionId}
                onSelectSession={handleSelectSession}
                onNewSession={handleNewSession}
                onDeleteSession={handleDeleteSession}
                isLoading={isSessionsLoading}
              />
            </div>
          )}
        </div>
      </BottomSheet>

      {/* Floating Chat Panel */}
      <ChatPanel
        onPlacesFound={handlePlacesFound}
        onAddPlaceToTrip={handleAddPlaceToTrip}
        onTripDraftCreated={handleTripDraftCreated}
        onPreviewTripDraft={setActiveTripDraft}
        userLocation={userLocation}
        defaultOpen={isChatOpen}
        sessionId={activeSessionId}
        authToken={session?.access_token}
        onSessionCreated={handleSessionCreated}
        sessionMessages={chatSessionMessages}
        contextPlaces={chatContextPlaces}
        initialPrompt={chatPrefill}
        hideLauncherOnMobile={isBottomSheetExpanded}
        onClosePreview={handleClosePreview}
        onLocatePlace={handleLocateChatPlace}
        tripPlaceIds={chatTripPlaceIds}
        resetKey={chatResetKey}
      />

      {/* New Trip Dialog */}
      <NewTripDialog
        isOpen={isNewTripDialogOpen}
        onClose={() => setIsNewTripDialogOpen(false)}
        onSuccess={handleNewTripSuccess}
        serverUrl={process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000"}
        sessionToken={session?.access_token || ""}
      />

      <AddTripStopDialog
        isOpen={isAddStopDialogOpen}
        onClose={() => setIsAddStopDialogOpen(false)}
        onAddPlace={handleAddPlaceToTrip}
        serverUrl={process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000"}
      />

      {/* Edit Trip Dialog */}
      <EditTripDialog
        isOpen={editingTrip !== null}
        onClose={() => setEditingTrip(null)}
        onSuccess={fetchSavedTrips}
        trip={editingTrip ? { ...editingTrip, title: editingTrip.name } : null}
        serverUrl={process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000"}
        sessionToken={session?.access_token || ""}
      />

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
