import { expect, test } from "bun:test";
import { withSessionHistory } from "../conversation-history";

const history = [
	{ role: "user", content: "แนะนำวัดหน่อย" },
	{ role: "assistant", content: "Wat Pho, Wat Suthat" },
];

test("adds history for a new turn even when the client sends its own system messages", () => {
	const request = [
		{ role: "system", content: "You are a helpful Bangkok travel assistant." },
		{ role: "system", content: "Visible places on current map view: ..." },
		{ role: "user", content: "อันไหนคนน้อยที่สุด" },
	];
	expect(withSessionHistory(request, history)).toEqual([request[0], request[1], ...history, request[2]]);
});

test("leaves requests that already carry their own conversation alone", () => {
	const request = [
		{ role: "user", content: "a" },
		{ role: "assistant", content: "b" },
		{ role: "user", content: "c" },
	];
	expect(withSessionHistory(request, history)).toEqual(request);
});

test("returns the request unchanged when there is no history", () => {
	const request = [{ role: "user", content: "hi" }];
	expect(withSessionHistory(request, [])).toEqual(request);
});
