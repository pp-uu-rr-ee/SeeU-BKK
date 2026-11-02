import { describe, expect, test } from "bun:test";
import { appendPlaceToTrip, mergeFetchedTrips, removeStop, restoreStop, toStopCategory } from "../trip-stop-utils";
import type { Trip } from "@/types/trip";

const baseTrip: Trip = {
	id: "trip-1",
	name: "Bangkok Day",
	date: "2026-04-05",
	totalDurationMin: 60,
	totalDistanceKm: 0,
	estimatedBudget: 0,
	notes: "",
	stops: [
		{
			id: "stop-1",
			placeId: "place-1",
			name: "Wat Arun",
			address: "Bangkok, Thailand",
			category: "temple",
			suggestedDurationMin: 60,
			lat: 13.7437,
			lng: 100.4889,
		},
	],
};

describe("appendPlaceToTrip", () => {
	test("returns missing-trip when no trip is selected", () => {
		const result = appendPlaceToTrip({
			trips: [baseTrip],
			selectedTripId: null,
			place: {
				id: "place-2",
				name: "Grand Palace",
				slug: "grand-palace",
				lat: 13.75,
				lng: 100.49,
				tags: ["Temple"],
			},
		});

		expect(result.status).toBe("missing-trip");
		expect(result.trips).toEqual([baseTrip]);
	});

	test("prevents duplicates by place id before falling back to name", () => {
		const result = appendPlaceToTrip({
			trips: [baseTrip],
			selectedTripId: "trip-1",
			place: {
				id: "place-1",
				name: "Wat Arun (duplicate label)",
				slug: "wat-arun",
				lat: 13.7437,
				lng: 100.4889,
				tags: ["Temple"],
			},
		});

		expect(result.status).toBe("duplicate");
		expect(result.trips[0]?.stops).toHaveLength(1);
	});

	test("appends a mapped stop and recomputes total duration", () => {
		const result = appendPlaceToTrip({
			trips: [baseTrip],
			selectedTripId: "trip-1",
			place: {
				id: "place-2",
				name: "Grand Palace",
				slug: "grand-palace",
				lat: 13.75,
				lng: 100.49,
				tags: ["museum", "history"],
				address: "Bangkok, Thailand",
				description: "Historic site",
			},
		});

		expect(result.status).toBe("added");
		expect(result.addedStop?.placeId).toBe("place-2");
		expect(result.trips[0]?.stops).toHaveLength(2);
		expect(result.trips[0]?.stops[1]).toMatchObject({
			name: "Grand Palace",
			address: "Bangkok, Thailand",
			category: "museum",
			notes: "Historic site",
		});
		expect(result.trips[0]?.totalDurationMin).toBe(120);
	});
});

describe("toStopCategory", () => {
	test("uses the first tag that is a known category, case-insensitively", () => {
		expect(toStopCategory(["Temple", "history"])).toBe("temple");
		expect(toStopCategory(["community"])).toBe("community");
		expect(toStopCategory(["riverside", "museum"])).toBe("museum");
	});

	test("maps aliases and falls back to a neutral place category", () => {
		expect(toStopCategory(["mall"])).toBe("shopping");
		expect(toStopCategory(["riverside"])).toBe("place");
		expect(toStopCategory([])).toBe("place");
		expect(toStopCategory(undefined)).toBe("place");
	});
});

describe("removeStop / restoreStop", () => {
	const trip: Trip = {
		...baseTrip,
		stops: [
			{ ...baseTrip.stops[0]!, id: "a" },
			{ ...baseTrip.stops[0]!, id: "b", name: "Wat Pho" },
			{ ...baseTrip.stops[0]!, id: "c", name: "Wat Suthat" },
		],
	};

	test("removes a stop and remembers where it was", () => {
		const result = removeStop([trip], "trip-1", "b");
		expect(result.trips[0]?.stops.map((s) => s.id)).toEqual(["a", "c"]);
		expect(result.removed).toEqual({ stop: trip.stops[1], index: 1 });
	});

	test("returns no removal for an unknown stop", () => {
		const result = removeStop([trip], "trip-1", "zzz");
		expect(result.removed).toBeNull();
		expect(result.trips).toEqual([trip]);
	});

	test("undo puts the stop back at its original position", () => {
		const { trips, removed } = removeStop([trip], "trip-1", "b");
		const restored = restoreStop(trips, "trip-1", removed!.stop, removed!.index);
		expect(restored[0]?.stops.map((s) => s.id)).toEqual(["a", "b", "c"]);
	});
});

describe("mergeFetchedTrips", () => {
	test("keeps local unsaved versions and takes the server copy for the rest", () => {
		const local: Trip[] = [
			{ ...baseTrip, id: "t1", name: "Local edit" },
			{ ...baseTrip, id: "t2", name: "Old" },
		];
		const server: Trip[] = [
			{ ...baseTrip, id: "t3", name: "Brand new" },
			{ ...baseTrip, id: "t1", name: "Server copy" },
			{ ...baseTrip, id: "t2", name: "Fresh" },
		];
		const merged = mergeFetchedTrips(server, local, new Set(["t1"]));
		expect(merged.map((t) => [t.id, t.name])).toEqual([
			["t3", "Brand new"],
			["t1", "Local edit"],
			["t2", "Fresh"],
		]);
	});
});
