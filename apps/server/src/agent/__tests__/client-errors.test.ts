import { expect, test } from "bun:test";
import { QUOTA_EXCEEDED, toClientErrorMessage } from "../client-errors";

test("maps provider quota / rate-limit failures to a stable code the UI can translate", () => {
	expect(toClientErrorMessage("429 status code (no body)\n\nTroubleshooting URL: https://docs.langchain.com/...")).toBe(QUOTA_EXCEEDED);
	expect(toClientErrorMessage("You exceeded your current quota")).toBe(QUOTA_EXCEEDED);
	expect(toClientErrorMessage("RESOURCE_EXHAUSTED")).toBe(QUOTA_EXCEEDED);
	expect(toClientErrorMessage("Rate limit reached for requests")).toBe(QUOTA_EXCEEDED);
});

test("passes other errors through unchanged", () => {
	expect(toClientErrorMessage("Agent processing failed")).toBe("Agent processing failed");
});
