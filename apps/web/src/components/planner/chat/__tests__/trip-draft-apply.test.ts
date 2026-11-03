import { describe, expect, test } from "bun:test";
import { tripDraftToApply } from "../lib/trip-draft";
import type { AssistantTurn, TripDraft } from "../types";

const draft = { title: "Temple walk", stops: [] } as unknown as TripDraft;

function turn(id: string, tripDraft: TripDraft | null): AssistantTurn {
	return { role: "assistant", id, text: "", workflowSteps: [], suggestions: [], tripDraft, errors: [] };
}

describe("tripDraftToApply", () => {
	test("a new assistant turn with a trip is shown on the map once", () => {
		expect(tripDraftToApply(turn("t1", draft), null)).toBe(draft);
	});

	test("the same turn is not re-applied, so the user can close the preview", () => {
		expect(tripDraftToApply(turn("t1", draft), "t1")).toBeNull();
	});

	test("turns without a trip and missing turns apply nothing", () => {
		expect(tripDraftToApply(turn("t2", null), "t1")).toBeNull();
		expect(tripDraftToApply(null, null)).toBeNull();
	});
});
