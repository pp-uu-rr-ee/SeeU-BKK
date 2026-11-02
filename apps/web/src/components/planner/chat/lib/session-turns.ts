import { uid } from "../constants";
import type { AssistantTurn, Turn, UiResponsePayload } from "../types";

export interface StoredSessionMessage {
	role: string;
	content: string;
	/** Server keeps the reply's UI payload here so the trip card can be restored */
	metadata?: { ui?: UiResponsePayload } | null;
}

function legacyJsonContent(content: string): { summary?: string; tripDraft?: AssistantTurn["tripDraft"] } | null {
	if (!content.trimStart().startsWith("{")) return null;
	try {
		return JSON.parse(content);
	} catch {
		return null;
	}
}

/** Rebuilds chat turns from stored session messages (reopening a past chat). */
export function sessionMessagesToTurns(messages: StoredSessionMessage[]): Turn[] {
	return messages
		.filter((message) => message.role === "user" || message.role === "assistant")
		.map((message): Turn => {
			if (message.role === "user") {
				return { role: "user", text: message.content, id: uid() };
			}

			const ui = message.metadata?.ui;
			const legacy = ui ? null : legacyJsonContent(message.content);
			return {
				role: "assistant",
				id: uid(),
				text: ui?.summary || legacy?.summary || message.content,
				workflowSteps: [],
				latency: undefined,
				suggestions: ui?.places ?? [],
				tripDraft: ui?.tripDraft ?? legacy?.tripDraft ?? null,
				errors: [],
				ui,
			} satisfies AssistantTurn;
		});
}
