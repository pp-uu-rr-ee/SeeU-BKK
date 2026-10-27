"use client";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { usePathname } from "next/navigation";
import { AuthButton } from "./auth/auth-button";
import LanguageToggle from "./language-toggle";
import { useTranslation } from "@/contexts/language-context";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

export default function Header() {
	const { user } = useAuth();
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const pathname = usePathname();
	const { t } = useTranslation();

	// Close the mobile menu after navigating
	useEffect(() => {
		setIsMobileMenuOpen(false);
	}, [pathname]);

	const links = useMemo(() => {
		const baseLinks = [
			{ to: "/", label: t("nav.home") },
			{ to: "/places", label: t("nav.places") },
			{ to: "/map", label: t("nav.map") },
			{ to: "/saved-trips", label: t("nav.savedTrips") },
		];

		if (user?.role === "admin" || user?.user_metadata?.role === "admin") {
			baseLinks.push({ to: "/admin/places", label: t("nav.admin") });
		}

		return baseLinks;
	}, [user, t]);

	const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

	return (
		<header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
			<div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
				{/* Wordmark */}
				<Link
					href="/"
					className="flex items-baseline gap-1.5 rounded-md font-display text-xl font-semibold tracking-tight text-foreground"
				>
					SeeU
					<span className="text-primary">Bangkok</span>
					<span aria-hidden className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-saffron" />
				</Link>

				{/* Desktop navigation */}
				<nav aria-label="Main" className="hidden md:block">
					<ul className="flex items-center gap-1">
						{links.map(({ to, label }) => (
							<li key={to}>
								<Link
									href={to}
									aria-current={isActive(to) ? "page" : undefined}
									className={cn(
										"relative inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition-colors duration-200",
										isActive(to)
											? "text-primary after:absolute after:inset-x-4 after:-bottom-[13px] after:h-0.5 after:rounded-full after:bg-primary"
											: "text-muted-foreground hover:bg-secondary hover:text-foreground"
									)}
								>
									{label}
								</Link>
							</li>
						))}
					</ul>
				</nav>

				{/* Right side */}
				<div className="flex items-center gap-3">
					<LanguageToggle className="hidden sm:flex" />
					<div className="hidden sm:flex">
						<AuthButton />
					</div>
					<button
						type="button"
						className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-secondary md:hidden"
						onClick={() => setIsMobileMenuOpen((open) => !open)}
						aria-expanded={isMobileMenuOpen}
						aria-controls="mobile-nav"
						aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
					>
						{isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
					</button>
				</div>
			</div>

			{/* Mobile navigation */}
			{isMobileMenuOpen && (
				<div id="mobile-nav" className="border-t border-border bg-background md:hidden">
					<nav aria-label="Main" className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
						<ul className="flex flex-col">
							{links.map(({ to, label }) => (
								<li key={to}>
									<Link
										href={to}
										aria-current={isActive(to) ? "page" : undefined}
										className={cn(
											"flex h-12 items-center rounded-xl px-3 text-base font-medium transition-colors",
											isActive(to) ? "bg-teal-soft text-primary" : "text-foreground hover:bg-secondary"
										)}
									>
										{label}
									</Link>
								</li>
							))}
						</ul>
						<div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
							<LanguageToggle />
							<AuthButton />
						</div>
					</nav>
				</div>
			)}
		</header>
	);
}
