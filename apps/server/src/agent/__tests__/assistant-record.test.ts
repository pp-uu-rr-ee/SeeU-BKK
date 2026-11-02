import { describe, expect, test } from "bun:test";
import { buildAssistantRecord } from "../assistant-record";

const tripDraft = {
	title: "Temple Morning",
	summary: "Two temples by the river.",
	constraints: {
		durationMinutes: 180,
		maxStops: 2,
		budgetLevel: "low" as const,
		groupType: "solo" as const,
		themes: ["temple"],
	},
	places: [
		{
			id: "wat-arun",
			name: "Wat Arun",
			slug: "wat-arun",
			lat: 13.7437,
			lng: 100.4889,
			tags: ["temple"],
		},
	],
	stops: [
		{
			id: "stop-1",
			place_id: "wat-arun",
			slug: "wat-arun",
			name: "Wat Arun",
			lat: 13.7437,
			lng: 100.4889,
			suggested_time_min: 60,
			notes: "Arrive early.",
			distance_from_prev_km: 0,
			travel_time_from_prev_min: 0,
		},
	],
	total_distance_km: 0,
	total_minutes: 60,
	warnings: ["Ferry queue may add time."],
	validation: {
		isValid: true,
		score: 92,
		warnings: [],
		suggestions: [],
	},
};

describe("buildAssistantRecord", () => {
	test("stores plain text for the LLM and the UI payload (trip draft) in metadata", () => {
		const record = buildAssistantRecord({
			sessionId: "s1",
			latestUiPayload: null,
			lastAssistantMessage: "Start at Wat Arun, then cross the river.",
			latestAssistantSummary: "Start at Wat Arun, then cross the river.",
			latestTripDraft: tripDraft,
			suggestedPlaces: [],
			latestWarnings: [],
		});

		expect(record?.content).toBe("Start at Wat Arun, then cross the river.");
		expect(record?.content.startsWith("{")).toBe(false);
		expect(record?.metadata.ui.intent).toBe("itinerary");
		expect(record?.metadata.ui.tripDraft?.title).toBe("Temple Morning");
	});

	test("an existing UI payload is kept as metadata while content stays its summary text", () => {
		const record = buildAssistantRecord({
			sessionId: "s1",
			latestUiPayload: {
				version: "1.0",
				intent: "chat",
				summary: "Here you go",
				places: [],
				tripDraft: null,
				actions: [],
				warnings: [],
				raw_text: "Here you go",
			},
			lastAssistantMessage: null,
			latestAssistantSummary: null,
			latestTripDraft: null,
			suggestedPlaces: [],
			latestWarnings: [],
		});

		expect(record?.content).toBe("Here you go");
		expect(record?.metadata.ui.summary).toBe("Here you go");
	});

	test("nothing to store when the assistant produced no reply", () => {
		expect(
			buildAssistantRecord({
				latestUiPayload: null,
				lastAssistantMessage: null,
				latestAssistantSummary: null,
				latestTripDraft: null,
				suggestedPlaces: [],
				latestWarnings: [],
			}),
		).toBeNull();
	});
});
