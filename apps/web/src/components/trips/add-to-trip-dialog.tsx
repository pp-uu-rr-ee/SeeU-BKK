"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/contexts/language-context";

// The server accepts at most this many stops per trip
const MAX_STOPS = 10;
const DEFAULT_STOP_MINUTES = 60;

interface SavedTripStop {
	place_id: string;
	suggested_time_min: number | null;
	notes: string;
}

interface SavedTripSummary {
	id: string;
	title: string;
	stops: SavedTripStop[];
}

interface AddToTripDialogProps {
	isOpen: boolean;
	onClose: () => void;
	place: { id: string; name: string };
	/** Name shown in the dialog and toasts (localized) */
	displayName: string;
	accessToken: string;
	serverUrl: string;
}

/** Picks one of the user's saved trips (or a new one) and appends the place as its last stop. */
export function AddToTripDialog({ isOpen, onClose, place, displayName, accessToken, serverUrl }: AddToTripDialogProps) {
	const { t } = useTranslation();
	const router = useRouter();
	const [trips, setTrips] = useState<SavedTripSummary[] | null>(null);
	const [loadFailed, setLoadFailed] = useState(false);
	const [savingTripId, setSavingTripId] = useState<string | null>(null);

	const loadTrips = useCallback(async () => {
		setLoadFailed(false);
		setTrips(null);
		try {
			const res = await fetch(`${serverUrl}/api/itineraries`, {
				headers: { Authorization: `Bearer ${accessToken}` },
			});
			const body = await res.json();
			if (!res.ok || !body.success || !Array.isArray(body.data)) throw new Error(body.error ?? `HTTP ${res.status}`);
			setTrips(
				body.data.map((trip: any) => ({
					id: trip.id,
					title: trip.title,
					stops: (trip.stops || []).map((stop: any) => ({
						place_id: stop.place_id,
						suggested_time_min: stop.suggested_time_min,
						notes: stop.notes || "",
					})),
				}))
			);
		} catch (error) {
			console.error("Error loading trips:", error);
			setLoadFailed(true);
		}
	}, [accessToken, serverUrl]);

	useEffect(() => {
		if (isOpen) void loadTrips();
	}, [isOpen, loadTrips]);

	const confirmAdded = (tripId: string, tripTitle: string) => {
		toast.success(t("addToTrip.added", { place: displayName, trip: tripTitle }), {
			action: { label: t("addToTrip.viewTrip"), onClick: () => router.push(`/saved-trips/${tripId}`) },
		});
		onClose();
	};

	const addToExisting = async (trip: SavedTripSummary) => {
		setSavingTripId(trip.id);
		try {
			const res = await fetch(`${serverUrl}/api/itineraries/${trip.id}`, {
				method: "PUT",
				headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
				body: JSON.stringify({
					title: trip.title,
					stops: [
						...trip.stops.map((stop) => ({
							place_id: stop.place_id,
							suggested_time_min: stop.suggested_time_min || DEFAULT_STOP_MINUTES,
							notes: stop.notes,
						})),
						{ place_id: place.id, suggested_time_min: DEFAULT_STOP_MINUTES, notes: "" },
					],
				}),
			});
			const body = await res.json();
			if (!res.ok || !body.success) throw new Error(body.error ?? `HTTP ${res.status}`);
			confirmAdded(trip.id, trip.title);
		} catch (error) {
			console.error("Error adding place to trip:", error);
			toast.error(t("addToTrip.failed"));
		} finally {
			setSavingTripId(null);
		}
	};

	const addToNewTrip = async () => {
		setSavingTripId("new");
		try {
			const res = await fetch(`${serverUrl}/api/itineraries`, {
				method: "POST",
				headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
				body: JSON.stringify({
					title: displayName,
					stops: [{ place_id: place.id, suggested_time_min: DEFAULT_STOP_MINUTES, notes: "" }],
				}),
			});
			const body = await res.json();
			if (!res.ok || !body.success || !body.data?.id) throw new Error(body.error ?? `HTTP ${res.status}`);
			confirmAdded(body.data.id, displayName);
		} catch (error) {
			console.error("Error creating trip:", error);
			toast.error(t("addToTrip.failed"));
		} finally {
			setSavingTripId(null);
		}
	};

	const isBusy = savingTripId !== null;

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && !isBusy && onClose()}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>{t("addToTrip.title")}</DialogTitle>
					<DialogDescription>{t("addToTrip.description", { place: displayName })}</DialogDescription>
				</DialogHeader>

				<div className="max-h-[50vh] space-y-2 overflow-y-auto" aria-busy={trips === null && !loadFailed}>
					{loadFailed ? (
						<div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
							<p>{t("addToTrip.loadFailed")}</p>
							<Button variant="outline" className="mt-3 h-11" onClick={() => void loadTrips()}>
								{t("addToTrip.retry")}
							</Button>
						</div>
					) : trips === null ? (
						[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)
					) : trips.length === 0 ? (
						<p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
							{t("addToTrip.empty")}
						</p>
					) : (
						trips.map((trip) => {
							const alreadyIn = trip.stops.some((stop) => stop.place_id === place.id);
							const isFull = trip.stops.length >= MAX_STOPS;
							const status = alreadyIn
								? t("addToTrip.alreadyIn")
								: isFull
									? t("addToTrip.full", { max: String(MAX_STOPS) })
									: t("addToTrip.stopCount", { count: String(trip.stops.length) });
							return (
								<button
									key={trip.id}
									type="button"
									disabled={alreadyIn || isFull || isBusy}
									onClick={() => void addToExisting(trip)}
									className="flex min-h-14 w-full items-center gap-3 rounded-xl border bg-card px-4 py-2 text-left transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-card"
								>
									<MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden />
									<span className="min-w-0 flex-1">
										<span className="block truncate font-medium text-foreground">{trip.title}</span>
										<span className="block text-xs text-muted-foreground">{status}</span>
									</span>
									{savingTripId === trip.id ? (
										<Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
									) : alreadyIn ? (
										<Check className="h-4 w-4 text-primary" aria-hidden />
									) : null}
								</button>
							);
						})
					)}
				</div>

				<Button
					variant="outline"
					className="h-11 w-full gap-2"
					disabled={isBusy || loadFailed}
					onClick={() => void addToNewTrip()}
				>
					{savingTripId === "new" ? (
						<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
					) : (
						<Plus className="h-4 w-4" aria-hidden />
					)}
					{t("addToTrip.newTrip")}
				</Button>
			</DialogContent>
		</Dialog>
	);
}
