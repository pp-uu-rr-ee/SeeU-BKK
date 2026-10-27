"use client";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchPlacesList, type PlaceListItem } from "@/lib/places-api";
import { useTranslation } from "@/contexts/language-context";
import { PlaceTile, PlaceTileSkeleton } from "@/components/places/place-tile";
import { cn } from "@/lib/utils";

const PLACES_PER_PAGE = 9;

const normalizeTag = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, " ");

const formatTagLabel = (value: string) =>
  value
    .replace(/-/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export default function PlacesPage() {
  const { t } = useTranslation();
  const [places, setPlaces] = useState<PlaceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";

  const fetchPlaces = async () => {
    try {
      setLoading(true);
      setError(null);
      setPlaces(await fetchPlacesList({ serverUrl }));
    } catch (err) {
      console.error('Error fetching places:', err);
      setError(t("places.errorTitle"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Search handed over from the home page hero (?q=)
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setSearchTerm(q);
    fetchPlaces();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category]
    );
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSearchTerm("");
    setCurrentPage(1);
  };

  // Categories come from the tags actually present, most common first
  const categories = useMemo(() => {
    const counter = new Map<string, number>();
    for (const place of places) {
      for (const tag of place.tags || []) {
        const normalized = normalizeTag(tag);
        if (normalized) counter.set(normalized, (counter.get(normalized) || 0) + 1);
      }
    }
    return Array.from(counter.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, label: formatTagLabel(value), count }));
  }, [places]);

  const filteredPlaces = useMemo(() => {
    let result = places;

    if (selectedCategories.length > 0) {
      result = result.filter((place) => {
        const placeTags = (place.tags || []).map(normalizeTag);
        return selectedCategories.some((category) => placeTags.includes(category));
      });
    }

    const query = searchTerm.trim().toLowerCase();
    if (query) {
      result = result.filter((place) =>
        [place.name, place.name_th, place.description, place.description_th, place.address, place.area, ...(place.tags || [])]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(query))
      );
    }

    return result;
  }, [places, searchTerm, selectedCategories]);

  const totalPages = Math.max(1, Math.ceil(filteredPlaces.length / PLACES_PER_PAGE));
  const startIndex = (currentPage - 1) * PLACES_PER_PAGE;
  const currentPlaces = filteredPlaces.slice(startIndex, startIndex + PLACES_PER_PAGE);
  const hasFilters = selectedCategories.length > 0 || searchTerm.trim().length > 0;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    document.getElementById("places-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="max-w-md text-center" role="alert">
          <h1 className="font-display text-3xl font-semibold text-foreground">{t("places.errorTitle")}</h1>
          <p className="mt-3 text-muted-foreground">{t("places.errorDesc")}</p>
          <Button type="button" onClick={fetchPlaces} className="mt-6 h-11 rounded-full px-6">
            {t("places.retry")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Title + search */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 md:pt-16">
          <p className="mb-4 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-primary">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-saffron" />
            {t("places.curatedGems")}
          </p>
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
            <div>
              <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
                {t("places.pageTitle")}
              </h1>
              <p className="mt-4 max-w-xl text-lg text-muted-foreground">{t("places.pageSubtitle")}</p>
            </div>
            <div role="search">
              <label htmlFor="places-search" className="sr-only">
                {t("home.searchLabel")}
              </label>
              <div className="flex items-center gap-3 rounded-full border border-border bg-card px-5 shadow-card transition-shadow focus-within:shadow-card-hover focus-within:ring-2 focus-within:ring-ring/30">
                <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <input
                  id="places-search"
                  type="search"
                  placeholder={t("places.searchPlaceholder")}
                  className="h-14 min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    aria-label={t("places.clear")}
                    className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Category chips */}
          <div className="mt-8" role="group" aria-label={t("places.categoriesLabel")}>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              <button
                type="button"
                aria-pressed={selectedCategories.length === 0}
                onClick={() => {
                  setSelectedCategories([]);
                  setCurrentPage(1);
                }}
                className={cn(
                  "h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors",
                  selectedCategories.length === 0
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-primary/40"
                )}
              >
                {t("places.allGems")}
              </button>
              {categories.map((cat) => {
                const isSelected = selectedCategories.includes(cat.value);
                return (
                  <button
                    key={cat.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleCategory(cat.value)}
                    className={cn(
                      "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
                      isSelected
                        ? "border-primary bg-teal-soft text-primary"
                        : "border-border bg-card text-foreground hover:border-primary/40"
                    )}
                  >
                    {cat.label}
                    <span className={cn("text-xs", isSelected ? "text-primary/70" : "text-muted-foreground")}>{cat.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Results */}
      <section id="places-grid" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-10 sm:px-6 md:py-14">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {loading
              ? t("places.loading")
              : filteredPlaces.length === 1
                ? t("places.placeCount", { count: String(filteredPlaces.length) })
                : t("places.placesCount", { count: String(filteredPlaces.length) })}
          </p>
          {hasFilters && !loading && (
            <button type="button" onClick={clearFilters} className="text-sm font-medium text-primary hover:underline">
              {t("places.clear")}
            </button>
          )}
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            Array.from({ length: 6 }, (_, i) => <PlaceTileSkeleton key={i} />)
          ) : currentPlaces.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-border bg-card p-12 text-center">
              <p className="text-muted-foreground">{t("places.noResults")}</p>
              {hasFilters && (
                <Button type="button" variant="secondary" onClick={clearFilters} className="mt-4 h-10 rounded-full px-5">
                  {t("places.clear")}
                </Button>
              )}
            </div>
          ) : (
            currentPlaces.map((place, index) => (
              <PlaceTile key={place.id} place={place} lazy={index > 2} />
            ))
          )}
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label="Previous page"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => handlePageChange(page)}
                aria-current={page === currentPage ? "page" : undefined}
                className={cn(
                  "h-11 min-w-11 rounded-full px-3 text-sm font-medium transition-colors",
                  page === currentPage
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-foreground hover:bg-secondary"
                )}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </nav>
        )}
      </section>
    </div>
  );
}
