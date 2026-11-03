import type { AssistantTurn, TripDraft } from "../types";

export function buildTripDraftSavePayload(tripDraft: TripDraft) {
	return {
		title: tripDraft.title,
		total_minutes: tripDraft.total_minutes,
		total_distance_km: tripDraft.total_distance_km,
		context: {
			summary: tripDraft.summary,
			warnings: tripDraft.warnings,
			constraints: tripDraft.constraints,
		},
		stops: tripDraft.stops.map((stop) => ({
			place_id: stop.place_id,
			suggested_time_min: stop.suggested_time_min,
			notes: stop.notes ?? "",
			distance_from_prev_km: stop.distance_from_prev_km,
		})),
	};
}

/**
 * The trip to show on the map for the latest assistant turn: only once per
 * turn, so closing the preview (or picking a saved trip) is not undone on the
 * next render.
 */
export function tripDraftToApply(turn: AssistantTurn | null, appliedTurnId: string | null): TripDraft | null {
	if (!turn?.tripDraft || turn.id === appliedTurnId) return null;
	return turn.tripDraft;
}
