"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTranslation } from "@/contexts/language-context";

const Toaster = ({ ...props }: ToasterProps) => {
	const { theme = "system" } = useTheme();
	const { t } = useTranslation();

	return (
		<Sonner
			theme={theme as ToasterProps["theme"]}
			className="toaster group"
			containerAriaLabel={t("common.notifications")}
			style={
				{
					"--normal-bg": "var(--popover)",
					"--normal-text": "var(--popover-foreground)",
					"--normal-border": "var(--border)",
				} as React.CSSProperties
			}
			{...props}
		/>
	);
};

export { Toaster };
