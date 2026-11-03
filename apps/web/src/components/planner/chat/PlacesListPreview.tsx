import { useState } from "react";
import { motion } from "motion/react";
import { MapPin, Plus, Map, Check } from "lucide-react";
import { useTranslation } from "@/contexts/language-context";
import { useChatPlaceName } from "./lib/place-names";
import { tagLabel } from "@/lib/place-locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PlaceItem } from "./types";

interface PlacesListPreviewProps {
	places: PlaceItem[];
	onAdd?: (place: PlaceItem) => void;
	/** Show the place on the map */
	onLocate?: (place: PlaceItem) => void;
	/** Place ids already in the open trip; their Add button shows "Added" */
	addedPlaceIds?: string[];
}

function PlaceRow({
	place,
	index,
	onAdd,
	onLocate,
	isAdded,
}: {
	place: PlaceItem;
	index: number;
	onAdd?: () => void;
	onLocate?: () => void;
	isAdded?: boolean;
}) {
	const { t, locale } = useTranslation();
	const [imageError, setImageError] = useState(false);
	const { name, description } = useChatPlaceName()(place);

	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: index * 0.05 }}
			className="flex gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors"
		>
			{place.image_url && !imageError ? (
				<div className="w-12 h-12 rounded-md overflow-hidden bg-muted shrink-0">
					<img
						src={place.image_url}
						alt={name}
						className="w-full h-full object-cover"
						onError={() => setImageError(true)}
					/>
				</div>
			) : (
				<div className="w-12 h-12 rounded-md shrink-0 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
					<MapPin className="h-5 w-5 text-primary/60" />
				</div>
			)}

			<div className="flex-1 min-w-0">
				<h4 className="text-sm font-semibold text-foreground truncate">{name}</h4>
				{place.tags && place.tags.length > 0 && (
					<div className="flex gap-1 mt-1 flex-wrap">
						{place.tags.slice(0, 3).map((tag) => (
							<Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
								{tagLabel(tag, locale)}
							</Badge>
						))}
					</div>
				)}
				{description && (
					<p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
						{description}
					</p>
				)}
				<div className="flex gap-2 mt-2">
					{onAdd && (
						<Button
							size="sm"
							variant="outline"
							className="h-9 max-md:h-11 text-xs px-3 bg-transparent"
							onClick={onAdd}
							disabled={isAdded}
						>
							{isAdded ? <Check className="h-3 w-3 mr-1" aria-hidden /> : <Plus className="h-3 w-3 mr-1" aria-hidden />}
							{isAdded ? t("chat.actions.added") : t("chat.actions.add")}
						</Button>
					)}
					{onLocate && (
						<Button size="sm" variant="ghost" className="h-9 max-md:h-11 text-xs px-3" onClick={onLocate}>
							<Map className="h-3 w-3 mr-1" aria-hidden />
							{t("chat.actions.showOnMap")}
						</Button>
					)}
				</div>
			</div>
		</motion.div>
	);
}

export function PlacesListPreview({ places, onAdd, onLocate, addedPlaceIds = [] }: PlacesListPreviewProps) {
	const { t } = useTranslation();
	const [showAll, setShowAll] = useState(false);
	const visible = showAll ? places : places.slice(0, 5);
	const hiddenCount = places.length - 5;

	return (
		<div className="space-y-2">
			<div className="flex items-center gap-1.5">
				<MapPin className="h-3.5 w-3.5 text-primary" />
				<p className="text-sm font-semibold text-foreground">
					{t("chat.actions.placesFound", { count: String(places.length) })}
				</p>
			</div>
			<div className="space-y-2">
				{visible.map((place, idx) => (
					<PlaceRow
						key={place.slug || idx}
						place={place}
						index={idx}
						onAdd={onAdd ? () => onAdd(place) : undefined}
						onLocate={onLocate ? () => onLocate(place) : undefined}
						isAdded={addedPlaceIds.includes(place.id)}
					/>
				))}
				{!showAll && hiddenCount > 0 && (
					<Button
						variant="ghost"
						size="sm"
						className="w-full h-8 max-md:h-11 text-xs"
						onClick={() => setShowAll(true)}
					>
						{t("chat.actions.showMore", { count: String(hiddenCount) })}
					</Button>
				)}
			</div>
		</div>
	);
}
