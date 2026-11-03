"use client";

import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/language-context";
import type { Locale } from "@/lib/i18n";

interface ChatSession {
	id: string;
	updatedAt: Date;
	metadata: { title?: string };
}

interface ChatHistorySidebarProps {
	sessions: ChatSession[];
	activeSessionId: string | null;
	onSelectSession: (id: string) => void;
	onNewSession: () => void;
	onDeleteSession: (id: string) => void;
	isLoading: boolean;
}

function formatDate(date: Date, t: (key: string, vars?: Record<string, string>) => string, locale: Locale): string {
	const now = new Date();
	const d = new Date(date);
	const diffMs = now.getTime() - d.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) return t("chatHistory.today");
	if (diffDays === 1) return t("chatHistory.yesterday");
	if (diffDays < 7) return t("chatHistory.daysAgo", { n: String(diffDays) });
	return d.toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", { dateStyle: "medium" });
}

export function ChatHistorySidebar({
	sessions,
	activeSessionId,
	onSelectSession,
	onNewSession,
	onDeleteSession,
	isLoading,
}: ChatHistorySidebarProps) {
	const { t, locale } = useTranslation();
	return (
		<div className="flex flex-col h-full gap-3">
			<Button
				onClick={onNewSession}
				className="w-full gap-2 max-md:h-11"
				variant="outline"
			>
				<Plus className="h-4 w-4" aria-hidden />
				{t("chatHistory.newChat")}
			</Button>

			{isLoading ? (
				<div className="space-y-2">
					{[1, 2, 3].map((i) => (
						<div
							key={i}
							className="h-14 rounded-lg bg-secondary animate-pulse"
						/>
					))}
				</div>
			) : sessions.length === 0 ? (
				<div className="flex flex-col items-center justify-center flex-1 text-center text-muted-foreground gap-2 py-8">
					<MessageSquare className="h-8 w-8 opacity-40" />
					<p className="text-sm">{t("chatHistory.empty")}</p>
					<p className="text-xs">{t("chatHistory.emptyHint")}</p>
				</div>
			) : (
				<div className="flex flex-col gap-1 overflow-y-auto flex-1">
					{sessions.map((session) => {
						const dateLabel = formatDate(session.updatedAt, t, locale);
						const title = session.metadata?.title || t("chatHistory.chatOn", { date: dateLabel });
						const isActive = session.id === activeSessionId;

						return (
							<div
								key={session.id}
								className={cn(
									"group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors",
									isActive
										? "bg-primary/10 text-primary"
										: "hover:bg-secondary text-foreground/80"
								)}
								onClick={() => onSelectSession(session.id)}
								role="button"
								tabIndex={0}
								aria-current={isActive ? "true" : undefined}
								onKeyDown={(e) => {
									if (e.target !== e.currentTarget) return;
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										onSelectSession(session.id);
									}
								}}
							>
								<MessageSquare className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium truncate">{title}</p>
									<p className="text-xs text-muted-foreground">{dateLabel}</p>
								</div>
								{/* Visible on hover/keyboard focus; always visible on touch screens */}
								<Button
									variant="ghost"
									size="icon"
									className="h-9 w-9 max-md:h-11 max-md:w-11 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 max-md:opacity-100 shrink-0 text-muted-foreground hover:text-destructive"
									aria-label={t("chatHistory.delete", { title })}
									onClick={(e) => {
										e.stopPropagation();
										if (confirm(t("chatHistory.deleteConfirm"))) {
											onDeleteSession(session.id);
										}
									}}
								>
									<Trash2 className="h-4 w-4" aria-hidden />
								</Button>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
