import { useCallback, useState } from "react";
import type { Dispatch, KeyboardEvent, SetStateAction } from "react";
import { toast } from "sonner";
import { buildTripDraftSavePayload } from "../lib/trip-draft";
import type { TripDraft } from "../types";

interface UseChatActionsParams {
	startWithMessage: (text: string) => Promise<void>;
	lastAssistantTurn: { tripDraft: TripDraft | null } | null;
	user: unknown;
	session: { access_token?: string } | null;
	setIsItinerarySaved: (value: boolean) => void;
	clearConversation: () => void;
	/** Called with the new trip's id after "Save to My Trips" succeeds */
	onTripSaved?: (tripId: string | null) => void;
	t: (key: string) => string;
}

interface UseChatActionsResult {
	input: string;
	setInput: Dispatch<SetStateAction<string>>;
	isSavingItinerary: boolean;
	handleSend: () => void;
	handleKeyDown: (e: KeyboardEvent) => void;
	handleSaveItinerary: () => Promise<void>;
	handleViewPlace: (slug: string) => void;
	handleClearConversation: () => void;
}

export function useChatActions({
	startWithMessage,
	lastAssistantTurn,
	user,
	session,
	setIsItinerarySaved,
	clearConversation,
	onTripSaved,
	t,
}: UseChatActionsParams): UseChatActionsResult {
	const [input, setInput] = useState("");
	const [isSavingItinerary, setIsSavingItinerary] = useState(false);

	const handleSend = useCallback(() => {
		if (!input.trim()) return;
		void startWithMessage(input);
		setInput("");
	}, [input, startWithMessage]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSend();
			}
		},
		[handleSend],
	);

	const handleSaveItinerary = useCallback(async () => {
		if (!lastAssistantTurn?.tripDraft) return;

		if (!user || !session?.access_token) {
			toast.error(t("chat.actions.loginToSave"), {
				action: {
					label: t("chat.actions.logIn"),
					onClick: () => {
						window.location.href = "/auth/login";
					},
				},
			});
			return;
		}

		setIsSavingItinerary(true);
		try {
			const tripDraft = lastAssistantTurn.tripDraft;
			const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";

			const res = await fetch(`${serverUrl}/api/itineraries`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${session.access_token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(buildTripDraftSavePayload(tripDraft)),
			});

			const body = (await res.json()) as { success: boolean; data?: { id?: string }; error?: string };

			if (!res.ok || !body.success) {
				throw new Error(body.error ?? `Request failed (${res.status})`);
			}

			setIsItinerarySaved(true);
			onTripSaved?.(body.data?.id ?? null);
			toast.success(t("chat.actions.savedToast"));
		} catch (e: unknown) {
			console.error("Failed to save trip from chat:", e);
			toast.error(t("chat.actions.saveFailed"));
		} finally {
			setIsSavingItinerary(false);
		}
	}, [lastAssistantTurn, session, setIsItinerarySaved, user, onTripSaved, t]);

	const handleViewPlace = useCallback((slug: string) => {
		window.open(`/places/${slug}`, "_blank");
	}, []);

	const handleClearConversation = useCallback(() => {
		clearConversation();
	}, [clearConversation]);

	return {
		input,
		setInput,
		isSavingItinerary,
		handleSend,
		handleKeyDown,
		handleSaveItinerary,
		handleViewPlace,
		handleClearConversation,
	};
}
