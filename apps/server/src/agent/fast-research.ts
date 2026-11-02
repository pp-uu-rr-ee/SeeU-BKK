// Research without a tool-calling loop: the searches run in code, then the model is called once
// to pick and summarise. The ReAct researcher spent one LLM call per tool it chose to run.
import { supabase } from "@/lib/supabase";
import { search_places, nearby_places, isWithinRattanakosin } from "@/lib/tools";
import { extractPlanningConstraints } from "./domain/planning";
import { retrieveDocuments } from "./tools/retrieval";
import type { CandidatePlace, TripDraft } from "./state";

const CANDIDATE_LIMIT = 10;
const CANDIDATE_COLUMNS = "id, name, slug, description, tags, lat, lng, price, image_url, address";

export interface CandidateSearch {
	candidates: CandidatePlace[];
	/** What ran, for the chat's workflow display */
	toolCalls: Array<{ name: string; args: Record<string, unknown> }>;
}

export function mergeCandidates(lists: CandidatePlace[][], limit = CANDIDATE_LIMIT): CandidatePlace[] {
	const seen = new Set<string>();
	const merged: CandidatePlace[] = [];
	for (const place of lists.flat()) {
		if (seen.has(place.id)) continue;
		seen.add(place.id);
		merged.push(place);
		if (merged.length >= limit) break;
	}
	return merged;
}

/** Models often wrap JSON in ```json fences even when told not to */
export function stripJsonFences(text: string): string {
	const trimmed = text.trim();
	const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
	return fenced ? fenced[1].trim() : trimmed;
}

/**
 * Map the places the model chose back to the database rows we gave it, in the model's order.
 * Anything it did not get from the candidate list is dropped, so it cannot invent places or coordinates.
 */
export function pickSelectedCandidates(
	selected: Array<Record<string, unknown>> | undefined,
	candidates: CandidatePlace[]
): CandidatePlace[] {
	if (!Array.isArray(selected)) return [];
	const lower = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");
	const picked: CandidatePlace[] = [];
	for (const choice of selected) {
		const match = candidates.find(
			(candidate) =>
				(lower(choice.id) && lower(choice.id) === candidate.id.toLowerCase()) ||
				(lower(choice.slug) && lower(choice.slug) === candidate.slug.toLowerCase()) ||
				(lower(choice.name) && lower(choice.name) === candidate.name.toLowerCase())
		);
		if (match && !picked.includes(match)) picked.push(match);
	}
	return picked;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToCandidate(row: any): CandidatePlace {
	return {
		id: String(row.id),
		name: row.name || "Unknown Place",
		slug: row.slug || String(row.id),
		lat: typeof row.lat === "number" ? row.lat : undefined,
		lng: typeof row.lng === "number" ? row.lng : undefined,
		tags: Array.isArray(row.tags) ? row.tags : [],
		price: typeof row.price === "number" ? row.price : undefined,
		image_url: row.image_url || undefined,
		description: row.description || undefined,
		address: row.address || undefined,
	};
}

async function loadCandidates(ids: string[]): Promise<CandidatePlace[]> {
	if (ids.length === 0) return [];
	const { data, error } = await supabase
		.from("bangkok_unseen")
		.select(CANDIDATE_COLUMNS)
		.in("id", ids)
		.eq("is_published", true);
	if (error || !data) return [];
	const byId = new Map(data.map((row) => [String(row.id), rowToCandidate(row)]));
	return ids.map((id) => byId.get(id)).filter((place): place is CandidatePlace => Boolean(place));
}

/** Search text for this turn: the latest user message plus the one before it, so follow-ups
 * like "which one suits kids?" still find the places being discussed */
export function searchQueryFromConversation(messages: Array<{ role?: string; content?: unknown }>): string {
	return messages
		.filter((m) => m.role === "user" && typeof m.content === "string" && m.content.trim())
		.slice(-2)
		.map((m) => (m.content as string).trim())
		.join("\n");
}

/** Semantic + keyword search (and nearby when the user asks for places near them), merged */
export async function gatherCandidates(
	query: string,
	userLocation?: { lat: number; lng: number }
): Promise<CandidateSearch> {
	const toolCalls: CandidateSearch["toolCalls"] = [{ name: "vector_search", args: { query } }];
	const wantsNearby =
		Boolean(userLocation && isWithinRattanakosin(userLocation)) &&
		extractPlanningConstraints(query, { userLocation }).locationBias?.mode === "near_user";
	if (wantsNearby) toolCalls.push({ name: "nearby_places", args: { location: userLocation } });
	toolCalls.push({ name: "search_places", args: { query } });

	const [semantic, nearby, keyword] = await Promise.all([
		retrieveDocuments(query, CANDIDATE_LIMIT),
		wantsNearby && userLocation
			? nearby_places({ location: userLocation, radius_km: 2, limit: CANDIDATE_LIMIT }).catch(() => [])
			: Promise.resolve([]),
		search_places({ query, limit: CANDIDATE_LIMIT }).catch(() => []),
	]);

	// Nearby first when asked for, then by meaning, then by name match
	const ids = mergeCandidates(
		[
			nearby.map((p) => ({ id: p.id, name: p.name, slug: p.slug, tags: [] })),
			semantic.map((doc) => {
				const meta = doc.metadata as { id?: unknown; name?: unknown };
				return { id: String(meta.id), name: String(meta.name), slug: "", tags: [] };
			}),
			keyword.map((p) => ({ id: p.id, name: p.name, slug: p.slug, tags: [] })),
		],
		CANDIDATE_LIMIT
	).map((p) => p.id);

	return { candidates: await loadCandidates(ids), toolCalls };
}

/**
 * Compact form for the prompt: enough to choose and describe, without bloating the request.
 * Places are labelled P1..Pn because models mangle long UUIDs when copying them back.
 */
export function candidatesForPrompt(candidates: CandidatePlace[]) {
	return candidates.map(({ name, tags, description }, index) => ({
		ref: `P${index + 1}`,
		name,
		tags,
		description: description ? description.slice(0, 240) : undefined,
	}));
}

/** Remove "(P1)" / "(P2, P3)" references the model sometimes leaves in its reply */
export function stripPlaceRefs(text: string): string {
	return text.replace(/\s*\((?:P\d+(?:,\s*)?)+\)/g, "").trim();
}

/** Map the model's picks (P-refs, or names / slugs / ids it copied instead) back to candidates */
export function resolvePlaceRefs(refs: string[], candidates: CandidatePlace[]): CandidatePlace[] {
	return pickSelectedCandidates(
		refs.map((ref) => {
			const index = ref.trim().match(/^P?(\d+)$/i);
			const byRef = index ? candidates[Number(index[1]) - 1] : undefined;
			return byRef ? { id: byRef.id } : { id: ref, slug: ref, name: ref };
		}),
		candidates
	);
}

/** The trip being discussed, as prompt text. The selection call only sees the conversation,
 * so without this a follow-up like "how long will this take?" has nothing to refer to. */
export function tripContextForPrompt(draft: TripDraft | null | undefined): string {
	if (!draft) return "";
	const stops = draft.stops.map((stop, index) => {
		const leg = index > 0 && stop.distance_from_prev_km
			? `, ${stop.distance_from_prev_km} km / ${stop.travel_time_from_prev_min} min from previous`
			: "";
		return `${index + 1}. ${stop.name} (${stop.suggested_time_min} min${leg})`;
	});
	return [
		`CURRENT TRIP: "${draft.title}", ${draft.total_minutes} min in total, ${draft.total_distance_km} km.`,
		...stops,
		"Answer questions about this trip from these details.",
	].join("\n");
}
