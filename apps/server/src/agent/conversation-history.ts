type ChatMessage = { role: string; content: string };

/**
 * Put stored session history in front of a new turn. The web client sends its own system
 * messages plus only the latest user message, so "a new turn" means: no assistant messages and
 * a single user message (counting all messages missed the client's system lines, so history
 * was never loaded and follow-up questions lost their context).
 */
export function withSessionHistory(messages: ChatMessage[], history: ChatMessage[]): ChatMessage[] {
	const conversation = messages.filter((m) => m.role === "user" || m.role === "assistant");
	if (history.length === 0 || conversation.length !== 1 || conversation[0].role !== "user") {
		return messages;
	}
	const system = messages.filter((m) => m.role === "system");
	return [...system, ...history, ...conversation];
}
