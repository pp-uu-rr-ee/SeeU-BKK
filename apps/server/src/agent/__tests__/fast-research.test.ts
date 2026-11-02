import { describe, expect, test } from "bun:test";
import {
	candidatesForPrompt,
	mergeCandidates,
	pickSelectedCandidates,
	resolvePlaceRefs,
	searchQueryFromConversation,
	stripJsonFences,
	stripPlaceRefs,
} from "../fast-research";
import type { CandidatePlace } from "../state";

const place = (id: string, name = id): CandidatePlace => ({ id, name, slug: id, lat: 13.75, lng: 100.49, tags: [] });

describe("mergeCandidates", () => {
	test("keeps first-seen order, drops duplicates and caps the list", () => {
		const merged = mergeCandidates([[place("a"), place("b")], [place("b"), place("c")], [place("d")]], 3);
		expect(merged.map((p) => p.id)).toEqual(["a", "b", "c"]);
	});
});

describe("stripJsonFences", () => {
	test("unwraps fenced JSON", () => {
		expect(stripJsonFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
		expect(stripJsonFences('```\n{"a":1}\n```')).toBe('{"a":1}');
	});
	test("leaves plain text alone", () => {
		expect(stripJsonFences(' {"a":1} ')).toBe('{"a":1}');
		expect(stripJsonFences("hello")).toBe("hello");
	});
});

describe("pickSelectedCandidates", () => {
	const candidates = [place("wat-pho", "Wat Pho"), place("museum-siam", "Museum Siam"), place("sanam-luang", "Sanam Luang")];

	test("keeps the model's order but uses the database copy of each place", () => {
		const picked = pickSelectedCandidates(
			[{ id: "museum-siam", name: "Museum", lat: 0, lng: 0 }, { id: "wat-pho" }],
			candidates
		);
		expect(picked).toEqual([candidates[1], candidates[0]]);
	});

	test("matches by slug or name and drops places that are not candidates", () => {
		const picked = pickSelectedCandidates(
			[{ slug: "sanam-luang" }, { name: "wat pho" }, { id: "made-up", name: "Invented Cafe" }],
			candidates
		);
		expect(picked.map((p) => p.id)).toEqual(["sanam-luang", "wat-pho"]);
	});

	test("returns an empty list when the model picked nothing", () => {
		expect(pickSelectedCandidates([], candidates)).toEqual([]);
		expect(pickSelectedCandidates(undefined, candidates)).toEqual([]);
	});
});

describe("short place references", () => {
	const candidates = [place("uuid-1", "Wat Pho"), place("uuid-2", "Museum Siam"), place("uuid-3", "Sanam Luang")];

	test("candidatesForPrompt labels places P1..Pn instead of long ids", () => {
		expect(candidatesForPrompt(candidates).map((c) => c.ref)).toEqual(["P1", "P2", "P3"]);
		expect(candidatesForPrompt(candidates)[0]).not.toHaveProperty("id");
	});

	test("resolvePlaceRefs accepts refs, bare numbers, names and ids, skipping unknowns", () => {
		const picked = resolvePlaceRefs(["P2", "3", "wat pho", "uuid-2", "P9", "Invented Cafe"], candidates);
		expect(picked.map((p) => p.id)).toEqual(["uuid-2", "uuid-3", "uuid-1"]);
	});
});

test("stripPlaceRefs removes P-refs the model leaks into prose", () => {
	expect(stripPlaceRefs("Start at Wat Pho (P1), then Museum Siam (P2, P3).")).toBe("Start at Wat Pho, then Museum Siam.");
	expect(stripPlaceRefs("เริ่มจากวัดโพธิ์ (P1) แล้วไป P2")).toBe("เริ่มจากวัดโพธิ์ แล้วไป P2");
});

describe("searchQueryFromConversation", () => {
	test("adds the previous user message so follow-ups keep their context", () => {
		const query = searchQueryFromConversation([
			{ role: "system", content: "{}" },
			{ role: "user", content: "แนะนำพิพิธภัณฑ์แถวนี้หน่อย" },
			{ role: "assistant", content: "Museum Siam ..." },
			{ role: "user", content: "อันไหนเหมาะกับเด็กที่สุด" },
		]);
		expect(query).toBe("แนะนำพิพิธภัณฑ์แถวนี้หน่อย\nอันไหนเหมาะกับเด็กที่สุด");
	});

	test("uses the only user message as is, and empty when there is none", () => {
		expect(searchQueryFromConversation([{ role: "user", content: " Wat Pho " }])).toBe("Wat Pho");
		expect(searchQueryFromConversation([{ role: "assistant", content: "hi" }])).toBe("");
	});
});
