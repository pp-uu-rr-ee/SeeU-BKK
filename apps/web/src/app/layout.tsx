import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans_Thai, Noto_Serif_Thai } from "next/font/google";
import "../index.css";
import Providers from "@/components/providers";
import Header from "@/components/header";

// Display serif for Latin; Thai glyphs fall back to Noto Serif Thai (see --font-display)
const fraunces = Fraunces({
	variable: "--font-fraunces",
	subsets: ["latin"],
	display: "swap",
});

const notoSerifThai = Noto_Serif_Thai({
	variable: "--font-noto-serif-thai",
	subsets: ["thai"],
	weight: ["500", "600", "700"],
	display: "swap",
});

const plexSansThai = IBM_Plex_Sans_Thai({
	variable: "--font-plex-thai",
	subsets: ["thai", "latin"],
	weight: ["400", "500", "600", "700"],
	display: "swap",
});

export const metadata: Metadata = {
	title: "SeeU Bangkok — Discover Bangkok beyond the guidebook",
	description: "Find hidden gems in Bangkok's old town, plan walking routes on the map, and ask an AI trip planner in Thai or English.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			{/* Font variables live on <body>: next-themes rewrites the <html> class at runtime */}
			<body
				className={`${fraunces.variable} ${notoSerifThai.variable} ${plexSansThai.variable} font-sans antialiased`}
			>
				<Providers>
					<div className="min-h-screen bg-background">
						<Header />
						<main>
							{children}
						</main>
					</div>
				</Providers>
			</body>
		</html>
	);
}
