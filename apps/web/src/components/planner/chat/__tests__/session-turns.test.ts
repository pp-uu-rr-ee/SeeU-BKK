import { describe, expect, test } from "bun:test";
import { sessionMessagesToTurns } from "../lib/session-turns";
import type { AssistantTurn, TripDraft } from "../types";

const tripDraft = {
	title: "ทริปครึ่งวันแถววัดโพธิ์",
	summary: "",
	places: [],
	stops: [{ id: "s1", place_id: "p1", slug: "wat-pho", name: "Wat Pho", suggested_time_min: 60 }],
	total_distance_km: 1.2,
	total_minutes: 90,
	warnings: [],
} as unknown as TripDraft;

describe("sessionMessagesToTurns", () => {
	test("restores the trip draft and places from message metadata", () => {
		const turns = sessionMessagesToTurns([
			{ role: "user", content: "ช่วยจัดทริปครึ่งวันแถววัดโพธิ์ให้หน่อย" },
			{
				role: "assistant",
				content: "เริ่มที่ Wat Pho",
				metadata: {
					ui: {
						version: "1.0",
						intent: "itinerary",
						summary: "เริ่มที่ Wat Pho",
						places: [{ id: "p1", name: "Wat Pho", slug: "wat-pho" }],
						tripDraft,
						actions: [],
						warnings: [],
						raw_text: "เริ่มที่ Wat Pho",
					},
				},
			},
		]);

		expect(turns).toHaveLength(2);
		const assistant = turns[1] as AssistantTurn;
		expect(assistant.text).toBe("เริ่มที่ Wat Pho");
		expect(assistant.tripDraft?.title).toBe("ทริปครึ่งวันแถววัดโพธิ์");
		expect(assistant.suggestions.map((p) => p.slug)).toEqual(["wat-pho"]);
		expect(assistant.ui?.intent).toBe("itinerary");
	});

	test("old plain-text messages still load as text without a card", () => {
		const turns = sessionMessagesToTurns([{ role: "assistant", content: "Plain answer" }]);
		const assistant = turns[0] as AssistantTurn;
		expect(assistant.text).toBe("Plain answer");
		expect(assistant.tripDraft).toBeNull();
		expect(assistant.suggestions).toEqual([]);
	});

	test("legacy JSON content keeps working", () => {
		const turns = sessionMessagesToTurns([
			{ role: "assistant", content: JSON.stringify({ summary: "From JSON", tripDraft }) },
		]);
		const assistant = turns[0] as AssistantTurn;
		expect(assistant.text).toBe("From JSON");
		expect(assistant.tripDraft?.title).toBe("ทริปครึ่งวันแถววัดโพธิ์");
	});

	test("skips system and tool messages", () => {
		expect(sessionMessagesToTurns([{ role: "tool", content: "{}" }, { role: "system", content: "x" }])).toEqual([]);
	});
});
