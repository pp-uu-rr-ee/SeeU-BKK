"use client";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, MoreVertical, Edit, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Trip } from "@/types/trip";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/language-context";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  trips: Trip[];
  selectedTripId: string | null;
  onSelectTrip: (id: string | null) => void;
  onNewTripClick: () => void;
  onDeleteTrip?: (tripId: string) => void;
  onEditTrip?: (tripId: string) => void;
  onReorderTrips?: (orderedTripIds: string[]) => void;
  isLoading?: boolean;
}

export function TripListColumn({
  trips,
  selectedTripId,
  onSelectTrip,
  onNewTripClick,
  onDeleteTrip,
  onEditTrip,
  onReorderTrips,
  isLoading = false,
}: Props) {
  const { t, locale } = useTranslation();
  // trip.date holds created_at (ISO); format it for the current language
  const formatTripDate = (value: string) =>
    value && !Number.isNaN(Date.parse(value))
      ? new Date(value).toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", { dateStyle: "medium" })
      : value;
  const [searchQuery, setSearchQuery] = useState("");
  const [orderedTrips, setOrderedTrips] = useState<Trip[]>(trips);

  // keep local order in sync when trips prop changes (e.g., external updates)
  useEffect(() => {
    setOrderedTrips(trips);
  }, [trips]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Filter trips based on search query
  const filteredTrips = useMemo(
    () =>
      orderedTrips.filter(
        (trip) =>
          trip.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          formatTripDate(trip.date).toLowerCase().includes(searchQuery.toLowerCase())
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orderedTrips, searchQuery, locale]
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const currentIndex = orderedTrips.findIndex((t) => t.id === active.id);
    const overIndex = orderedTrips.findIndex((t) => t.id === over.id);
    if (currentIndex === -1 || overIndex === -1) return;

    const newOrder = arrayMove(orderedTrips, currentIndex, overIndex);
    setOrderedTrips(newOrder);
    if (onReorderTrips) {
      onReorderTrips(newOrder.map((t) => t.id));
    }
  }

  // First load: placeholders instead of flashing the empty state
  if (trips.length === 0 && isLoading) {
    return (
      <aside
        className="flex flex-col gap-4 h-full"
        role="complementary"
        aria-label={t("tripList.label")}
        aria-busy="true"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-foreground">{t("tripList.title")}</h2>
        </div>
        <Skeleton className="h-10 w-full" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </aside>
    );
  }

  // Empty state when no trips exist
  if (trips.length === 0) {
    return (
      <aside
        className="flex flex-col gap-4 h-full"
        role="complementary"
        aria-label={t("tripList.label")}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-foreground">{t("tripList.title")}</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-12 px-4">
            <p className="text-muted-foreground mb-4">{t("tripList.empty")}</p>
            <Button onClick={onNewTripClick}>{t("tripList.createFirst")}</Button>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="flex flex-col gap-4 h-full"
      role="complementary"
      aria-label={t("tripList.label")}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-foreground">{t("tripList.title")}</h2>
        <Button size="sm" className="max-md:h-11" onClick={onNewTripClick}>
          {t("tripList.newTrip")}
        </Button>
      </div>

      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          placeholder={t("tripList.searchPlaceholder")}
          className="pl-9 max-md:h-11"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={t("tripList.searchPlaceholder")}
        />
      </div>

      {/* No results state */}
      {filteredTrips.length === 0 && searchQuery && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">
            {t("tripList.noMatch", { query: searchQuery })}
          </p>
        </div>
      )}

      {/* Trip list */}
      {filteredTrips.length > 0 && (
        <div className="flex-1 overflow-y-auto pr-2 -mr-2" role="list">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedTrips.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {filteredTrips.map((trip) => {
                  const isSelected = trip.id === selectedTripId;
                  return (
                    <SortableTripCard key={trip.id} id={trip.id}>
                      <Card
                        className={cn(
                          "cursor-pointer transition-all bg-card border border-border shadow-sm hover:shadow-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                          isSelected && "bg-teal-soft border-primary/30"
                        )}
                        role="listitem"
                      >
                        <CardContent className="p-4 flex items-start gap-2">
                          <button
                            className="flex-1 text-left"
                            onClick={() => onSelectTrip(isSelected ? null : trip.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onSelectTrip(isSelected ? null : trip.id);
                              }
                            }}
                            aria-label={t("tripList.selectTrip", { name: trip.name })}
                            aria-pressed={isSelected}
                          >
                            <h3
                              className={cn(
                                "font-semibold text-foreground",
                                isSelected && "text-primary"
                              )}
                            >
                              {trip.name}
                            </h3>
                            <p
                              className={cn(
                                "text-sm text-muted-foreground",
                                isSelected && "text-primary"
                              )}
                            >
                              {formatTripDate(trip.date)}
                            </p>
                          </button>

                          {(onEditTrip || onDeleteTrip) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 max-md:h-11 max-md:w-11 shrink-0"
                                  aria-label={t("tripList.actions", { name: trip.name })}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {onEditTrip && (
                                  <DropdownMenuItem
                                    onClick={() => onEditTrip(trip.id)}
                                  >
                                    <Edit className="mr-2 h-4 w-4" aria-hidden />
                                    {t("tripList.edit")}
                                  </DropdownMenuItem>
                                )}
                                {onDeleteTrip && (
                                  <DropdownMenuItem
                                    onClick={() => onDeleteTrip(trip.id)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                                    {t("tripList.delete")}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </CardContent>
                      </Card>
                    </SortableTripCard>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </aside>
  );
}

interface SortableTripCardProps {
  id: string;
  children: React.ReactNode;
}

function SortableTripCard({ id, children }: SortableTripCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn("touch-none", isDragging && "opacity-90 shadow-lg")}
    >
      {children}
    </div>
  );
}
