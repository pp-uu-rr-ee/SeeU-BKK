import type { CandidatePlace, TripDraft, UiResponsePayload } from "./state";
import { buildUiPayload } from "./ui-payload";

export interface AssistantRecord {
	/** Plain text: replayed to the LLM as conversation history */
	content: string;
	/** Structured reply so a reopened chat can restore its trip card and places */
	metadata: { ui: UiResponsePayload };
}

/**
 * What to persist for one assistant reply. Builds the same UI payload the
 * live stream sends when the agent did not produce one itself.
 */
export function buildAssistantRecord(options: {
	sessionId?: string;
	latestUiPayload: UiResponsePayload | null;
	lastAssistantMessage: string | null;
	latestAssistantSummary: string | null;
	latestTripDraft: TripDraft | null;
	suggestedPlaces: CandidatePlace[];
	latestWarnings: string[];
}): AssistantRecord | null {
	const ui =
		options.latestUiPayload ??
		(options.lastAssistantMessage
			? buildUiPayload({
					sessionId: options.sessionId,
					summary: options.latestAssistantSummary || options.lastAssistantMessage,
					rawText: options.lastAssistantMessage,
					places: options.suggestedPlaces,
					tripDraft: options.latestTripDraft,
					warnings: options.latestWarnings,
				})
			: null);
	if (!ui) return null;

	return {
		content: options.lastAssistantMessage || ui.summary,
		metadata: { ui },
	};
}
