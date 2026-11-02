import { describe, expect, test } from "bun:test";
import { isShareToken, toPublicTrip } from "../trip-share";

const ownerTrip = {
	id: "9076a674-d9a2-472d-b26a-4d98c107fdd1",
	user_id: "owner-user-id",
	title: "Old Town Walk",
	total_minutes: 209,
	total_distance_km: 2.4,
	created_at: "2026-11-02T11:11:23.019Z",
	context: { chat: "private planning context" },
	share_token: "3f1c2a9e-7b6d-4c1e-9a8f-2b3c4d5e6f70",
};

const stops = [
	{
		id: "stop-1",
		position: 1,
		suggested_time_min: 60,
		distance_from_prev_km: 0,
		notes: "Go early",
		place_id: "place-1",
		place: { id: "place-1", name: "Wat Pho", lat: 13.7465, lng: 100.493, tags: ["temple"], image_url: "", address: "Bangkok, Thailand" },
	},
];

describe("toPublicTrip", () => {
	test("keeps what a visitor needs, including stop notes", () => {
		const trip = toPublicTrip(ownerTrip, stops);
		expect(trip).toEqual({
			title: "Old Town Walk",
			total_minutes: 209,
			total_distance_km: 2.4,
			created_at: "2026-11-02T11:11:23.019Z",
			stops,
		});
	});

	test("never exposes the owner, planning context, trip id or the token", () => {
		const json = JSON.stringify(toPublicTrip(ownerTrip, stops));
		expect(json).not.toContain("owner-user-id");
		expect(json).not.toContain("private planning context");
		expect(json).not.toContain(ownerTrip.id);
		expect(json).not.toContain(ownerTrip.share_token);
	});
});

describe("isShareToken", () => {
	test("accepts UUIDs only", () => {
		expect(isShareToken("3f1c2a9e-7b6d-4c1e-9a8f-2b3c4d5e6f70")).toBe(true);
		expect(isShareToken("not-a-token")).toBe(false);
		expect(isShareToken("")).toBe(false);
		expect(isShareToken("3f1c2a9e-7b6d-4c1e-9a8f-2b3c4d5e6f70' or 1=1")).toBe(false);
	});
});
