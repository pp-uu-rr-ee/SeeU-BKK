import { useTranslation } from "@/contexts/language-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, X } from "lucide-react";
import type { KeyboardEvent } from "react";

interface ChatInputBarProps {
	input: string;
	isStreaming: boolean;
	hasTurns: boolean;
	onInputChange: (value: string) => void;
	onKeyDown: (e: KeyboardEvent) => void;
	onSend: () => void;
	onStop: () => void;
	onClearConversation: () => void;
}

export function ChatInputBar({
	input,
	isStreaming,
	hasTurns,
	onInputChange,
	onKeyDown,
	onSend,
	onStop,
	onClearConversation,
}: ChatInputBarProps) {
	const { t } = useTranslation();
	return (
		<div className="p-4 border-t bg-muted/30 shrink-0 space-y-2">
			<div className="flex gap-2">
				<Input
					value={input}
					onChange={(e) => onInputChange(e.target.value)}
					onKeyDown={onKeyDown}
					placeholder={t("chat.actions.inputPlaceholder")}
					aria-label={t("chat.actions.inputPlaceholder")}
					disabled={isStreaming}
					className="flex-1 h-10"
				/>
				{isStreaming ? (
					<Button
						onClick={onStop}
						size="icon"
						variant="outline"
						className="shrink-0 h-10 w-10"
						title={t("chat.actions.stop")}
						aria-label={t("chat.actions.stop")}
					>
						<X className="h-4 w-4" />
					</Button>
				) : (
					<Button
						onClick={onSend}
						disabled={!input.trim()}
						size="icon"
						className="shrink-0 h-10 w-10"
						aria-label={t("chat.actions.send")}
					>
						<Send className="h-4 w-4" />
					</Button>
				)}
			</div>
			{hasTurns && !isStreaming && (
				<button
					onClick={onClearConversation}
					className="min-h-8 text-xs text-muted-foreground hover:text-foreground transition-colors"
				>
					{t("chat.actions.clear")}
				</button>
			)}
		</div>
	);
}
