export interface PlaceItem {
	id: string;
	name: string;
	slug: string;
	lat?: number;
	lng?: number;
	tags?: string[];
	price?: number;
	image_url?: string;
	description?: string;
	address?: string;
}

export interface PlanningConstraints {
	durationMinutes: number;
	maxStops: number;
	budgetLevel: "low" | "medium" | "high" | "flexible";
	groupType: "solo" | "couple" | "family" | "group";
	themes: string[];
	locationBias?: {
		mode: "none" | "near_user" | "near_area";
		origin?: { lat: number; lng: number };
		label?: string;
	};
}

export interface TripValidation {
	isValid: boolean;
	score: number;
	warnings: string[];
	suggestions: string[];
}

export interface TripDraftStop {
	id: string;
	place_id: string;
	slug: string;
	name: string;
	lat?: number;
	lng?: number;
	suggested_time_min: number;
	travel_time_from_prev_min: number;
	distance_from_prev_km: number;
	notes: string;
}

export interface TripDraft {
	title: string;
	summary: string;
	constraints: PlanningConstraints;
	places: PlaceItem[];
	stops: TripDraftStop[];
	total_distance_km: number;
	total_minutes: number;
	warnings: string[];
	validation: TripValidation;
}

export type WorkflowStepType =
	| "planner"
	| "search"
	| "retrieve"
	| "reasoning"
	| "route"
	| "location";

export interface WorkflowStepData {
	type: WorkflowStepType | string;
	label: string;
	badges?: string[];
	status: "complete" | "loading" | "pending";
}

export interface UserTurn {
	role: "user";
	text: string;
	id: string;
}

export interface AssistantTurn {
	role: "assistant";
	text: string;
	workflowSteps: WorkflowStepData[];
	latency?: number;
	suggestions: PlaceItem[];
	tripDraft: TripDraft | null;
	errors: string[];
	ui?: UiResponsePayload;
	id: string;
}

export type Turn = UserTurn | AssistantTurn;

export interface UiResponsePayload {
	version: "1.0";
	intent: "chat" | "place_recommendation" | "itinerary";
	sessionId?: string;
	summary: string;
	places: PlaceItem[];
	tripDraft: TripDraft | null;
	actions: Array<{ type: string; label: string }>;
	warnings: string[];
	raw_text: string;
}

export interface PendingTurn {
	workflowSteps: WorkflowStepData[];
	text: string;
	suggestions: PlaceItem[];
	tripDraft: TripDraft | null;
	errors: string[];
	ui?: UiResponsePayload;
}

export interface ParsedPlace {
	name: string;
	description: string;
	lat?: number;
	lng?: number;
}

export interface ParsedItinerary {
	title: string;
	stops: Array<{
		name: string;
		suggested_time_min: number;
		distance_from_prev_km: number;
		notes: string;
		lat?: number;
		lng?: number;
	}>;
	total_distance_km: number;
	total_minutes: number;
}

export interface ChatPanelProps {
	onPlacesFound?: (places: PlaceItem[]) => void;
	onAddPlaceToTrip?: (place: PlaceItem | PlaceItem[]) => void;
	/** Takes the chat's trip draft off the map */
	onClosePreview?: () => void;
	/** Shows a suggested place on the map */
	onLocatePlace?: (place: PlaceItem) => void;
	/** Place ids already in the trip that "Add" targets */
	tripPlaceIds?: string[];
	/** Saved trips as comma-joined place ids in stop order; a matching draft shows as saved */
	savedTripKeys?: string[];
	/** Called with the new trip's id after the chat's trip is saved */
	onTripSaved?: (tripId: string | null) => void;
	/** All places with their Thai fields, used to show chat cards in Thai */
	placeCatalog?: Array<{ id: string; name_th?: string | null; description_th?: string | null }>;
	onTripDraftCreated?: (tripDraft: TripDraft) => void;
	onPreviewTripDraft?: (tripDraft: TripDraft) => void;
	userLocation?: { lat: number; lng: number };
	defaultOpen?: boolean;
	sessionId?: string | null;
	authToken?: string;
	onSessionCreated?: (id: string | null) => void;
	sessionMessages?: Array<{ role: string; content: string; metadata?: { ui?: UiResponsePayload } | null }> | null;
	contextPlaces?: Array<{ id: string; name: string; slug?: string; tags?: string[] }>;
	/** Text to prefill in the input (e.g. arriving from a place page); not sent automatically */
	initialPrompt?: string;
	/** Hide the launcher on phones (e.g. while the trip sheet is expanded and would be covered) */
	hideLauncherOnMobile?: boolean;
	/** Changing this starts a fresh conversation (e.g. "New Chat" in the history list) */
	resetKey?: number;
}
