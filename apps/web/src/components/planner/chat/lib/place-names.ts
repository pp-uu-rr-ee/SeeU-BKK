import { createContext, useCallback, useContext } from "react";
import { useTranslation } from "@/contexts/language-context";
import { localizedPlace } from "@/lib/place-locale";

export interface PlaceThaiFields {
	name_th?: string | null;
	description_th?: string | null;
}

/** Thai name/description by place id; chat payloads only carry the English fields. */
export const ChatPlaceNamesContext = createContext<ReadonlyMap<string, PlaceThaiFields>>(new Map());

/** Returns a function giving a chat place's name and description in the current language. */
export function useChatPlaceName() {
	const thaiById = useContext(ChatPlaceNamesContext);
	const { locale } = useTranslation();
	return useCallback(
		(place: { id?: string; place_id?: string; name: string; description?: string | null }) =>
			localizedPlace({ ...place, ...thaiById.get(place.place_id || place.id || "") }, locale),
		[thaiById, locale],
	);
}
