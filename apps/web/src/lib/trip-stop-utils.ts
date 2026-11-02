import { STOP_CATEGORIES, type StopCategory, type Trip, type TripStop } from "@/types/trip";

export interface TripPlaceCandidate {
	id: string;
	name: string;
	slug: string;
	lat?: number;
	lng?: number;
	tags?: string[];
	address?: string | null;
	description?: string;
}

export type AppendPlaceToTripResult =
	| {
			status: "missing-trip" | "missing-location" | "duplicate";
			trips: Trip[];
			tripName?: string;
			addedStop?: undefined;
	  }
	| {
			status: "added";
			trips: Trip[];
			tripName: string;
			addedStop: TripStop;
	  };

const CATEGORY_ALIASES: Record<string, StopCategory> = {
	mall: "shopping",
};

/** First place tag that is a known stop category; "place" when none match. */
export function toStopCategory(tags?: string[] | null): StopCategory {
	for (const tag of tags ?? []) {
		const key = tag.trim().toLowerCase();
		if ((STOP_CATEGORIES as readonly string[]).includes(key)) return key as StopCategory;
		if (CATEGORY_ALIASES[key]) return CATEGORY_ALIASES[key];
	}
	return "place";
}

function isDuplicateStop(stop: TripStop, place: TripPlaceCandidate): boolean {
	if (stop.placeId && place.id && stop.placeId === place.id) {
		return true;
	}

	return stop.name.trim().toLowerCase() === place.name.trim().toLowerCase();
}

export function appendPlaceToTrip({
	trips,
	selectedTripId,
	place,
}: {
	trips: Trip[];
	selectedTripId: string | null;
	place: TripPlaceCandidate;
}): AppendPlaceToTripResult {
	if (!selectedTripId) {
		return { status: "missing-trip", trips };
	}

	if (typeof place.lat !== "number" || typeof place.lng !== "number") {
		return { status: "missing-location", trips };
	}

	const targetTrip = trips.find((trip) => trip.id === selectedTripId);
	if (!targetTrip) {
		return { status: "missing-trip", trips };
	}

	if (targetTrip.stops.some((stop) => isDuplicateStop(stop, place))) {
		return { status: "duplicate", trips, tripName: targetTrip.name };
	}

	const addedStop: TripStop = {
		id: `stop-${Date.now()}`,
		placeId: place.id,
		name: place.name,
		address: place.address?.trim() || "",
		category: toStopCategory(place.tags),
		suggestedDurationMin: 60,
		lat: place.lat,
		lng: place.lng,
		notes: place.description,
	};

	const updatedTrips = trips.map((trip) => {
		if (trip.id !== selectedTripId) {
			return trip;
		}

		const stops = [...trip.stops, addedStop];
		return {
			...trip,
			stops,
			totalDurationMin: stops.reduce(
				(sum, stop) => sum + stop.suggestedDurationMin,
				0
			),
		};
	});

	return {
		status: "added",
		trips: updatedTrips,
		tripName: targetTrip.name,
		addedStop,
	};
}

export interface RemovedStop {
	stop: TripStop;
	index: number;
}

/** Removes a stop and remembers its position so the removal can be undone. */
export function removeStop(
	trips: Trip[],
	tripId: string,
	stopId: string
): { trips: Trip[]; removed: RemovedStop | null } {
	const trip = trips.find((item) => item.id === tripId);
	const index = trip ? trip.stops.findIndex((stop) => stop.id === stopId) : -1;
	if (!trip || index === -1) {
		return { trips, removed: null };
	}

	return {
		trips: trips.map((item) =>
			item.id === tripId ? { ...item, stops: item.stops.filter((stop) => stop.id !== stopId) } : item
		),
		removed: { stop: trip.stops[index]!, index },
	};
}

/** Puts a removed stop back at its original position (clamped to the current list). */
export function restoreStop(trips: Trip[], tripId: string, stop: TripStop, index: number): Trip[] {
	return trips.map((trip) => {
		if (trip.id !== tripId || trip.stops.some((item) => item.id === stop.id)) {
			return trip;
		}
		const stops = [...trip.stops];
		stops.splice(Math.min(index, stops.length), 0, stop);
		return { ...trip, stops };
	});
}

/** A refetch must not wipe trips the user edited but has not saved yet. */
export function mergeFetchedTrips(serverTrips: Trip[], localTrips: Trip[], unsavedTripIds: Set<string>): Trip[] {
	const local = new Map(localTrips.map((trip) => [trip.id, trip] as const));
	return serverTrips.map((trip) =>
		unsavedTripIds.has(trip.id) && local.has(trip.id) ? local.get(trip.id)! : trip
	);
}
