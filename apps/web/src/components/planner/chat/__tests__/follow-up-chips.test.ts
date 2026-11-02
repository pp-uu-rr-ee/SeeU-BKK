import { describe, expect, test } from "bun:test";
import { getFollowUpChips } from "../lib/chat-parsers";
import type { AssistantTurn } from "../types";

function turn(text: string, overrides: Partial<AssistantTurn> = {}): AssistantTurn {
	return {
		role: "assistant",
		id: "t1",
		text,
		workflowSteps: [],
		suggestions: [],
		tripDraft: null,
		errors: [],
		...overrides,
	};
}

describe("getFollowUpChips", () => {
	test("answers in Thai get Thai chips even when the UI is English", () => {
		const chips = getFollowUpChips(turn("สำหรับทริปครึ่งวันแถววัดโพธิ์ เริ่มที่ Wat Pho"), false, "en");
		expect(chips).toEqual(["เล่าเพิ่มอีก", "แนะนำที่คล้ายกัน", "วางแผนทริปหนึ่งวัน"]);
	});

	test("English answers follow the UI language", () => {
		expect(getFollowUpChips(turn("Wat Pho is a great start."), false, "en")).toEqual([
			"Tell me more",
			"Show me something similar",
			"Plan a day trip",
		]);
		expect(getFollowUpChips(turn("Wat Pho is a great start."), false, "th")[0]).toBe("เล่าเพิ่มอีก");
	});

	test("fills the place name into suggestion chips", () => {
		const chips = getFollowUpChips(
			turn("Here are some spots", { suggestions: [{ id: "1", name: "Wat Pho", slug: "wat-pho" }] }),
			false,
			"en",
		);
		expect(chips).toEqual(["Plan a route through these", "Find food near Wat Pho", "Which is best for families?"]);
	});
});
