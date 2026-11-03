import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { AssistantTurn, PendingTurn, TripDraft, Turn } from "../types";
import { uid } from "../constants";
import { sessionMessagesToTurns, type StoredSessionMessage } from "../lib/session-turns";
import { tripDraftToApply } from "../lib/trip-draft";

interface UseChatHistoryParams {
	onPlacesFound?: (places: AssistantTurn["suggestions"]) => void;
	onTripDraftCreated?: (tripDraft: TripDraft) => void;
}

interface UseChatHistoryResult {
	turns: Turn[];
	pendingTurn: PendingTurn | null;
	setPendingTurn: Dispatch<SetStateAction<PendingTurn | null>>;
	lastAssistantTurn: AssistantTurn | null;
	isItinerarySaved: boolean;
	setIsItinerarySaved: Dispatch<SetStateAction<boolean>>;
	appendUserTurn: (text: string) => void;
	commitPending: (pending: PendingTurn, latency: number) => void;
	clearConversation: () => void;
	loadSession: (rawMessages: StoredSessionMessage[]) => void;
}

export function useChatHistory({
	onPlacesFound,
	onTripDraftCreated,
}: UseChatHistoryParams): UseChatHistoryResult {
	const [turns, setTurns] = useState<Turn[]>([]);
	const [pendingTurn, setPendingTurn] = useState<PendingTurn | null>(null);
	const [isItinerarySaved, setIsItinerarySaved] = useState(false);

	const lastAssistantTurn = useMemo(
		() =>
			([...turns].reverse().find((turn) => turn.role === "assistant") as AssistantTurn | undefined) ??
			null,
		[turns],
	);

	useEffect(() => {
		if (lastAssistantTurn?.suggestions.length && onPlacesFound) {
			onPlacesFound(lastAssistantTurn.suggestions);
		}
	}, [lastAssistantTurn, onPlacesFound]);

	// Show each new trip on the map once; re-sending it on every render made the
	// preview impossible to close or replace with a saved trip
	const appliedDraftTurnIdRef = useRef<string | null>(null);
	useEffect(() => {
		const draft = tripDraftToApply(lastAssistantTurn, appliedDraftTurnIdRef.current);
		if (!draft || !onTripDraftCreated) return;
		appliedDraftTurnIdRef.current = lastAssistantTurn?.id ?? null;
		onTripDraftCreated(draft);
		setIsItinerarySaved(false);
	}, [lastAssistantTurn, onTripDraftCreated]);

	const appendUserTurn = useCallback((text: string) => {
		setTurns((prev) => [...prev, { role: "user", text, id: uid() }]);
	}, []);

	const commitPending = useCallback((pending: PendingTurn, latency: number) => {
		const committed: AssistantTurn = {
			role: "assistant",
			id: uid(),
			text: pending.text,
			workflowSteps: pending.workflowSteps.map((step) => ({ ...step, status: "complete" })),
			latency,
			suggestions: pending.suggestions,
			tripDraft: pending.tripDraft,
			errors: pending.errors,
			ui: pending.ui,
		};
		setTurns((prev) => [...prev, committed]);
		setPendingTurn(null);
	}, []);

	const clearConversation = useCallback(() => {
		setTurns([]);
		setPendingTurn(null);
		setIsItinerarySaved(false);
	}, []);

	const loadSession = useCallback((rawMessages: StoredSessionMessage[]) => {
		const converted = sessionMessagesToTurns(rawMessages);
		setTurns(converted);
		setPendingTurn(null);
		setIsItinerarySaved(false);
	}, []);

	return {
		turns,
		pendingTurn,
		setPendingTurn,
		lastAssistantTurn,
		isItinerarySaved,
		setIsItinerarySaved,
		appendUserTurn,
		commitPending,
		clearConversation,
		loadSession,
	};
}
