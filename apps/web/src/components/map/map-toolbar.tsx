"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Map,
  List,
  Route,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface MapToolbarProps {
  isTripsPanelOpen: boolean;
  isItineraryPanelOpen: boolean;
  isChatOpen: boolean;
  onToggleTripsPanel: () => void;
  onToggleItineraryPanel: () => void;
  onToggleChat: () => void;
  className?: string;
}

export function MapToolbar({
  isTripsPanelOpen,
  isItineraryPanelOpen,
  isChatOpen,
  onToggleTripsPanel,
  onToggleItineraryPanel,
  onToggleChat,
  className,
}: MapToolbarProps) {
  return (
    <div
      className={cn(
        "absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-card/95 backdrop-blur-md rounded-full shadow-lg px-2 py-1.5 border border-border",
        className
      )}
    >
      {/* Trips Panel Toggle */}
      <Button
        variant={isTripsPanelOpen ? "default" : "ghost"}
        size="sm"
        onClick={onToggleTripsPanel}
        className={cn(
          "rounded-full gap-2 transition-all",
          isTripsPanelOpen
            ? "bg-primary text-white hover:bg-primary/90"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
        )}
        aria-label={isTripsPanelOpen ? "Hide trips panel" : "Show trips panel"}
      >
        <List className="h-4 w-4" />
        <span className="hidden sm:inline">Trips</span>
        {isTripsPanelOpen ? (
          <ChevronLeft className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </Button>

      {/* Divider */}
      <div className="w-px h-6 bg-secondary" />

      {/* Itinerary Panel Toggle */}
      <Button
        variant={isItineraryPanelOpen ? "default" : "ghost"}
        size="sm"
        onClick={onToggleItineraryPanel}
        className={cn(
          "rounded-full gap-2 transition-all",
          isItineraryPanelOpen
            ? "bg-primary text-white hover:bg-primary/90"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
        )}
        aria-label={
          isItineraryPanelOpen ? "Hide itinerary panel" : "Show itinerary panel"
        }
      >
        <Route className="h-4 w-4" />
        <span className="hidden sm:inline">Itinerary</span>
        {isItineraryPanelOpen ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </Button>

      {/* Divider */}
      <div className="w-px h-6 bg-secondary" />

      {/* Chat Toggle */}
      <Button
        variant={isChatOpen ? "default" : "ghost"}
        size="sm"
        onClick={onToggleChat}
        className={cn(
          "rounded-full gap-2 transition-all",
          isChatOpen
            ? "bg-primary text-white hover:bg-primary/90"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
        )}
        aria-label={isChatOpen ? "Hide chat" : "Show chat"}
      >
        <MessageSquare className="h-4 w-4" />
        <span className="hidden sm:inline">Chat</span>
      </Button>
    </div>
  );
}
