"use client";

import { useState } from "react";
import Link from "next/link";
import { ImageOff, Star } from "lucide-react";
import type { PlaceListItem } from "@/lib/places-api";
import { useTranslation } from "@/contexts/language-context";
import { cn } from "@/lib/utils";

interface PlaceTileProps {
	place: PlaceListItem;
	className?: string;
	/** Lazy-load the photo (true for below-the-fold grids) */
	lazy?: boolean;
}

/** Editorial place card used on the home page and the places index */
export function PlaceTile({ place, className, lazy = true }: PlaceTileProps) {
	const { t, locale } = useTranslation();
	const [imageFailed, setImageFailed] = useState(false);

	const name = (locale === "th" && place.name_th) || place.name;
	const description = (locale === "th" && place.description_th) || place.description;
	const showImage = Boolean(place.image_url) && !imageFailed;

	return (
		<Link
			href={`/places/${place.slug}`}
			className={cn(
				"group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-shadow duration-300 hover:shadow-card-hover",
				className
			)}
		>
			<div className="relative aspect-[4/3] overflow-hidden bg-teal-soft">
				{showImage ? (
					<img
						src={place.image_url}
						alt=""
						loading={lazy ? "lazy" : "eager"}
						onError={() => setImageFailed(true)}
						className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
					/>
				) : (
					<div className="flex h-full w-full items-center justify-center text-primary/50">
						<ImageOff className="h-8 w-8" aria-hidden />
					</div>
				)}
				{place.tags.length > 0 && (
					<div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
						{place.tags.slice(0, 2).map((tag) => (
							<span
								key={tag}
								className="rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium capitalize text-foreground backdrop-blur-sm"
							>
								{tag.replace(/-/g, " ")}
							</span>
						))}
					</div>
				)}
			</div>

			<div className="flex flex-1 flex-col p-5">
				{place.area && (
					<p className="mb-1.5 text-xs font-medium uppercase tracking-[0.16em] text-primary">{place.area}</p>
				)}
				<h3 className="font-display text-xl font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
					{name}
				</h3>
				{description && (
					<p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
				)}

				<div className="mt-auto flex items-center justify-between pt-4 text-sm">
					{place.avg_rating !== null ? (
						<span className="inline-flex items-center gap-1 font-medium text-foreground">
							<Star className="h-4 w-4 fill-saffron text-saffron" aria-hidden />
							{place.avg_rating.toFixed(1)}
							<span className="font-normal text-muted-foreground">({place.review_count})</span>
						</span>
					) : (
						<span className="text-muted-foreground">{t("placeDetail.noReviews")}</span>
					)}
					<span className={cn("font-medium", place.price > 0 ? "text-foreground" : "text-primary")}>
						{place.price > 0 ? `฿${place.price}` : t("placeDetail.free")}
					</span>
				</div>
			</div>
		</Link>
	);
}

export function PlaceTileSkeleton() {
	return (
		<div className="overflow-hidden rounded-2xl border border-border bg-card" aria-hidden>
			<div className="aspect-[4/3] animate-pulse bg-secondary" />
			<div className="space-y-3 p-5">
				<div className="h-3 w-24 animate-pulse rounded bg-secondary" />
				<div className="h-5 w-3/4 animate-pulse rounded bg-secondary" />
				<div className="h-4 w-full animate-pulse rounded bg-secondary" />
			</div>
		</div>
	);
}
