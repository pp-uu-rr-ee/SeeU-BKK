"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Compass, Map, MessageCircle, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlaceTile, PlaceTileSkeleton } from "@/components/places/place-tile";
import { fetchPlacesList, type PlaceListItem } from "@/lib/places-api";
import { useTranslation } from "@/contexts/language-context";

const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";

// Shown first in the hero mosaic and featured row when present; any other place with a photo fills the rest
const FEATURED_SLUGS = [
	"wat-pho",
	"phra-sumen-fort",
	"trok-mo-morning-market",
	"loha-prasat",
	"museum-siam",
	"khlong-ong-ang-walking-street",
];

function pickFeatured(places: PlaceListItem[], count: number) {
	const withImages = places.filter((p) => p.image_url);
	const preferred = FEATURED_SLUGS.map((slug) => withImages.find((p) => p.slug === slug)).filter(
		(p): p is PlaceListItem => Boolean(p)
	);
	const rest = withImages.filter((p) => !preferred.includes(p));
	return [...preferred, ...rest].slice(0, count);
}

function Eyebrow({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "light" }) {
	return (
		<p
			className={`mb-4 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] ${
				tone === "light" ? "text-teal-soft" : "text-primary"
			}`}
		>
			<span aria-hidden className="h-1.5 w-1.5 rounded-full bg-saffron" />
			{children}
		</p>
	);
}

export default function Home() {
	const { t, locale } = useTranslation();
	const router = useRouter();
	const [places, setPlaces] = useState<PlaceListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadFailed, setLoadFailed] = useState(false);
	const [query, setQuery] = useState("");

	useEffect(() => {
		fetchPlacesList({ serverUrl })
			.then(setPlaces)
			.catch((err) => {
				console.error("Error fetching places:", err);
				setLoadFailed(true);
			})
			.finally(() => setLoading(false));
	}, []);

	const featured = useMemo(() => pickFeatured(places, 6), [places]);
	const mosaic = featured.slice(0, 3);

	const handleSearch = (event: FormEvent) => {
		event.preventDefault();
		const term = query.trim();
		router.push(term ? `/places?q=${encodeURIComponent(term)}` : "/places");
	};

	const steps = [
		{ icon: Compass, title: t("home.step1Title"), desc: t("home.step1Desc") },
		{ icon: Map, title: t("home.step2Title"), desc: t("home.step2Desc") },
		{ icon: MessageCircle, title: t("home.step3Title"), desc: t("home.step3Desc") },
	];

	const placeName = (p: PlaceListItem) => (locale === "th" && p.name_th) || p.name;

	return (
		<div className="bg-background">
			{/* Hero */}
			<section className="relative overflow-hidden">
				<div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-24">
					<div>
						<Eyebrow>{t("home.eyebrow")}</Eyebrow>
						<h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
							{t("home.heroTitle")}{" "}
							<span className="italic text-primary">{t("home.heroTitleAccent")}</span>
						</h1>
						<p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
							{t("home.heroSubtitle")}
						</p>

						<form onSubmit={handleSearch} role="search" className="mt-8 max-w-xl">
							<label htmlFor="hero-search" className="sr-only">
								{t("home.searchLabel")}
							</label>
							<div className="flex items-center gap-2 rounded-full border border-border bg-card p-1.5 pl-5 shadow-card transition-shadow focus-within:shadow-card-hover focus-within:ring-2 focus-within:ring-ring/30">
								<Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
								<input
									id="hero-search"
									type="search"
									value={query}
									onChange={(e) => setQuery(e.target.value)}
									placeholder={t("home.searchPlaceholder")}
									className="h-11 min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
								/>
								<Button type="submit" className="h-11 rounded-full px-6">
									{t("home.searchButton")}
								</Button>
							</div>
						</form>

						<div className="mt-6 flex flex-col gap-3 sm:flex-row">
							<Button asChild size="lg" variant="secondary" className="h-12 rounded-full px-6 text-base">
								<Link href="/map">
									<Map className="h-5 w-5" aria-hidden />
									{t("home.exploreMap")}
								</Link>
							</Button>
							<Button asChild size="lg" variant="ghost" className="h-12 rounded-full px-6 text-base text-primary hover:bg-teal-soft hover:text-primary">
								<Link href="/map?chat=true">
									<Sparkles className="h-5 w-5" aria-hidden />
									{t("home.askPlanner")}
								</Link>
							</Button>
						</div>

						<dl className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-border pt-6 text-sm text-muted-foreground">
							{places.length > 0 && (
								<div className="flex items-baseline gap-2">
									<dt className="sr-only">Places</dt>
									<dd className="font-display text-2xl font-semibold text-foreground">{places.length}</dd>
									<dd>{t("home.statPlacesLabel")}</dd>
								</div>
							)}
							<div className="flex items-center gap-2">
								<span aria-hidden className="h-1.5 w-1.5 rounded-full bg-saffron" />
								{t("home.statLanguages")}
							</div>
							<div className="flex items-center gap-2">
								<span aria-hidden className="h-1.5 w-1.5 rounded-full bg-saffron" />
								{t("home.statPlanner")}
							</div>
						</dl>
					</div>

					{/* Editorial photo mosaic of real places */}
					<div className="grid grid-cols-2 gap-3 sm:gap-4" aria-label={t("home.featuredTitle")}>
						{loading || mosaic.length < 3 ? (
							<>
								<div className="row-span-2 h-full min-h-[18rem] animate-pulse rounded-3xl bg-secondary" />
								<div className="aspect-square animate-pulse rounded-3xl bg-secondary" />
								<div className="aspect-square animate-pulse rounded-3xl bg-teal-soft" />
							</>
						) : (
							mosaic.map((place, index) => (
								<Link
									key={place.id}
									href={`/places/${place.slug}`}
									className={`group relative overflow-hidden rounded-3xl bg-teal-soft shadow-card ${
										index === 0 ? "row-span-2 h-full min-h-[18rem]" : "aspect-square"
									}`}
								>
									<img
										src={place.image_url}
										alt=""
										loading="eager"
										className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
									/>
									<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
									<div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
										{place.area && (
											<p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/80">{place.area}</p>
										)}
										<p className="font-display text-lg font-semibold leading-snug text-white sm:text-xl">
											{placeName(place)}
										</p>
									</div>
								</Link>
							))
						)}
					</div>
				</div>
			</section>

			{/* Featured places */}
			<section className="border-t border-border bg-card/60 py-16 md:py-24">
				<div className="mx-auto max-w-7xl px-4 sm:px-6">
					<div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
						<div className="max-w-2xl">
							<Eyebrow>{t("home.featuredEyebrow")}</Eyebrow>
							<h2 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
								{t("home.featuredTitle")}
							</h2>
							<p className="mt-3 text-muted-foreground">{t("home.featuredSubtitle")}</p>
						</div>
						<Link
							href="/places"
							className="inline-flex items-center gap-1.5 self-start rounded-full text-sm font-medium text-primary hover:underline md:self-auto"
						>
							{t("home.seeAll")}
							<ArrowRight className="h-4 w-4" aria-hidden />
						</Link>
					</div>

					{loadFailed ? (
						<p className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-muted-foreground">
							{t("home.loadError")}
						</p>
					) : (
						<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
							{loading
								? Array.from({ length: 6 }, (_, i) => <PlaceTileSkeleton key={i} />)
								: featured.map((place) => <PlaceTile key={place.id} place={place} />)}
						</div>
					)}
				</div>
			</section>

			{/* How it works */}
			<section className="py-16 md:py-24">
				<div className="mx-auto max-w-7xl px-4 sm:px-6">
					<div className="max-w-2xl">
						<Eyebrow>{t("home.howEyebrow")}</Eyebrow>
						<h2 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
							{t("home.howTitle")}
						</h2>
					</div>
					<ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
						{steps.map(({ icon: Icon, title, desc }, index) => (
							<li key={title} className="relative border-t border-border pt-6">
								<span className="font-display text-5xl font-semibold text-saffron/80" aria-hidden>
									{String(index + 1).padStart(2, "0")}
								</span>
								<div className="mt-4 flex items-center gap-3">
									<span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-soft text-primary">
										<Icon className="h-5 w-5" aria-hidden />
									</span>
									<h3 className="text-lg font-semibold text-foreground">{title}</h3>
								</div>
								<p className="mt-3 leading-relaxed text-muted-foreground">{desc}</p>
							</li>
						))}
					</ol>
				</div>
			</section>

			{/* Closing CTA */}
			<section className="px-4 pb-16 sm:px-6 md:pb-24">
				<div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-primary px-6 py-14 text-primary-foreground sm:px-12 md:py-20">
					<div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full border-[28px] border-saffron/25" />
					<div aria-hidden className="absolute -bottom-32 right-32 h-64 w-64 rounded-full bg-white/5" />
					<div className="relative max-w-2xl">
						<Eyebrow tone="light">SeeU Bangkok</Eyebrow>
						<h2 className="font-display text-3xl font-semibold tracking-tight md:text-5xl">{t("home.ctaTitle")}</h2>
						<p className="mt-4 text-lg text-primary-foreground/80">{t("home.ctaSubtitle")}</p>
						<div className="mt-8 flex flex-col gap-3 sm:flex-row">
							<Button asChild size="lg" className="h-12 rounded-full bg-saffron px-7 text-base text-foreground hover:bg-saffron/90">
								<Link href="/map">
									{t("home.ctaPrimary")}
									<ArrowRight className="h-5 w-5" aria-hidden />
								</Link>
							</Button>
							<Button
								asChild
								size="lg"
								variant="outline"
								className="h-12 rounded-full border-white/40 bg-transparent px-7 text-base text-white hover:bg-white/10 hover:text-white"
							>
								<Link href="/places">{t("home.ctaSecondary")}</Link>
							</Button>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}
