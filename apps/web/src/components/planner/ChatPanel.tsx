"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Map, Maximize2, MessageSquare, Minimize2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useTranslation } from "@/contexts/language-context";
import { ChatInputBar } from "./chat/ChatInputBar";
import { ChatMessageList } from "./chat/ChatMessageList";
import { useChatActions } from "./chat/hooks/useChatActions";
import { useChatHistory } from "./chat/hooks/useChatHistory";
import { useChatStream } from "./chat/hooks/useChatStream";
import type { ChatPanelProps, PlaceItem } from "./chat/types";

export function ChatPanel({
	onPlacesFound,
	onAddPlaceToTrip,
	onTripDraftCreated,
	onPreviewTripDraft,
	userLocation,
	defaultOpen = false,
	sessionId,
	authToken,
	onSessionCreated,
	sessionMessages,
	contextPlaces,
	initialPrompt,
	hideLauncherOnMobile = false,
	onClosePreview,
	onLocatePlace,
	tripPlaceIds,
	savedTripKeys,
	onTripSaved,
	resetKey = 0,
}: ChatPanelProps) {
	const { t } = useTranslation();
	const quickSuggestions = [0, 1, 2, 3].map((i) => t(`chat.suggestions.${i}`));
	const [isOpen, setIsOpen] = useState(defaultOpen);
	const [isMinimized, setIsMinimized] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const { user, session } = useAuth();

	// React to defaultOpen changes (e.g., selecting a session from history)
	useEffect(() => {
		if (defaultOpen) setIsOpen(true);
	}, [defaultOpen]);

	const {
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
	} = useChatHistory({ onPlacesFound, onTripDraftCreated });

	// Load session messages when a session is selected from history
	useEffect(() => {
		if (sessionMessages) {
			// Drop the previous chat's trip from the map; the loaded chat re-applies its own
			onClosePreview?.();
			loadSession(sessionMessages);
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sessionMessages]);

	// "New Chat" / deleting the open chat: clear what is on screen and its trip preview
	const lastResetKeyRef = useRef(resetKey);
	useEffect(() => {
		if (lastResetKeyRef.current === resetKey) return;
		lastResetKeyRef.current = resetKey;
		clearConversation();
		onClosePreview?.();
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [resetKey]);

	const { isStreaming, startWithMessage, stop } = useChatStream({
		userLocation,
		sessionId,
		authToken,
		contextPlaces,
		onSessionCreated: (id) => onSessionCreated?.(id),
		appendUserTurn,
		setPendingTurn,
		commitPending,
		onAcceptedMessage: () => setIsItinerarySaved(false),
	});

	const {
		input,
		setInput,
		isSavingItinerary,
		handleSend,
		handleKeyDown,
		handleSaveItinerary,
		handleViewPlace,
		handleClearConversation,
	} = useChatActions({
		startWithMessage,
		lastAssistantTurn,
		user,
		session,
		setIsItinerarySaved,
		onTripSaved,
		t,
		clearConversation: () => {
			clearConversation();
			onClosePreview?.();
			onSessionCreated?.(null);
		},
	});

	// A draft whose stops match a saved trip counts as saved (e.g. reopening an older chat),
	// so "Save to My Trips" can't create a duplicate
	const lastDraftKey = lastAssistantTurn?.tripDraft?.stops.map((stop) => stop.place_id).join(",");
	const isDraftSaved = isItinerarySaved || (!!lastDraftKey && !!savedTripKeys?.includes(lastDraftKey));

	// "Show on map": focus the place on the map and minimise the chat, which sits over the
	// map on every screen size; places without coordinates fall back to their detail page
	const handleLocatePlace = (place: PlaceItem) => {
		if (onLocatePlace && typeof place.lat === "number" && typeof place.lng === "number") {
			onLocatePlace(place);
			setIsMinimized(true);
			return;
		}
		handleViewPlace(place.slug);
	};

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [turns, pendingTurn]);

	// Prefill the input when arriving with a prompt (e.g. "Ask Trip Assistant" on a place page)
	useEffect(() => {
		if (initialPrompt) setInput(initialPrompt);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initialPrompt]);

	// Distinct keys stop React reusing the launcher's motion.div for the panel;
	// otherwise opening mid-animation (deep link) leaves the panel stuck at a partial scale
	if (!isOpen) {
		return (
			<motion.div
				key="chat-launcher"
				initial={{ scale: 0, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={{ type: "spring", stiffness: 260, damping: 20 }}
			>
				<Button
					onClick={() => setIsOpen(true)}
					// Phones: above the trip sheet's peek; md+: bottom-right of the map, clear of the itinerary column
					className={cn(
						"fixed bottom-[136px] right-4 rounded-full w-14 h-14 shadow-xl z-50 md:bottom-6 md:right-[424px]",
						hideLauncherOnMobile && "max-md:hidden",
					)}
					size="icon"
					aria-label={t("chat.actions.open")}
				>
					<MessageSquare className="h-6 w-6" aria-hidden />
				</Button>
			</motion.div>
		);
	}

	return (
		<motion.div
			key="chat-panel"
			initial={{ y: 100, opacity: 0 }}
			animate={{ y: 0, opacity: 1 }}
			exit={{ y: 100, opacity: 0 }}
			transition={{ type: "spring", stiffness: 300, damping: 30 }}
		>
			<Card
				className={cn(
					// md+: docked over the map column so the itinerary panel stays visible
					"fixed bottom-4 right-4 md:bottom-6 md:right-[416px] shadow-2xl z-50 overflow-hidden flex flex-col gap-0 py-0",
					isMinimized
						? "w-80 h-16 max-md:bottom-[136px]"
						: "w-[95vw] max-w-[440px] h-[65vh] md:w-[440px] md:max-w-[calc(100vw-432px)] md:h-[680px] md:max-h-[calc(100vh-112px)]",
				)}
			>
				<CardHeader className="flex flex-row items-center justify-between py-3 [.border-b]:pb-3 px-4 border-b bg-card shrink-0">
					<CardTitle className="text-sm flex items-center gap-2 font-semibold">
						<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
							<Map className="h-4 w-4 text-primary" />
						</div>
						{t("chat.actions.title")}
						{isStreaming && (
							<span className="text-[10px] text-muted-foreground font-normal animate-pulse">
								{t("chat.actions.thinking")}
							</span>
						)}
					</CardTitle>
					<div className="flex gap-1">
						<Button
							variant="ghost"
							size="icon"
							className="h-10 w-10 max-md:h-11 max-md:w-11"
							onClick={() => setIsMinimized((v) => !v)}
							aria-label={isMinimized ? t("chat.actions.expand") : t("chat.actions.minimize")}
						>
							{isMinimized ? <Maximize2 className="h-4 w-4" aria-hidden /> : <Minimize2 className="h-4 w-4" aria-hidden />}
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="h-10 w-10 max-md:h-11 max-md:w-11"
							onClick={() => setIsOpen(false)}
							aria-label={t("chat.actions.close")}
						>
							<X className="h-4 w-4" aria-hidden />
						</Button>
					</div>
				</CardHeader>

				<AnimatePresence>
					{!isMinimized && (
						<motion.div
							initial={{ height: 0, opacity: 0 }}
							animate={{ height: "auto", opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							className="flex flex-col flex-1 min-h-0"
						>
							<CardContent className="flex-1 overflow-y-auto p-4 space-y-6">
								<ChatMessageList
									turns={turns}
									pendingTurn={pendingTurn}
									isStreaming={isStreaming}
									isSavingItinerary={isSavingItinerary}
									isItinerarySaved={isDraftSaved}
									quickSuggestions={quickSuggestions}
									messagesEndRef={messagesEndRef}
									onQuickSuggestion={(text) => {
										void startWithMessage(text);
									}}
									onAddPlace={onAddPlaceToTrip}
									onLocatePlace={handleLocatePlace}
									onDismissTripDraft={onClosePreview}
									tripPlaceIds={tripPlaceIds}
									onSaveItinerary={() => {
										void handleSaveItinerary();
									}}
									onPreviewTripDraft={onPreviewTripDraft}
									onFollowUp={(text) => {
										void startWithMessage(text);
									}}
								/>
							</CardContent>

							<ChatInputBar
								input={input}
								isStreaming={isStreaming}
								hasTurns={turns.length > 0}
								onInputChange={setInput}
								onKeyDown={handleKeyDown}
								onSend={handleSend}
								onStop={stop}
								onClearConversation={handleClearConversation}
							/>
						</motion.div>
					)}
				</AnimatePresence>
			</Card>
		</motion.div>
	);
}
