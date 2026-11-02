// Error text sent to the chat UI. Known failures become stable codes the web app translates.

/** The LLM provider refused because the (free-tier) quota or rate limit ran out */
export const QUOTA_EXCEEDED = "quota_exceeded";

const QUOTA_PATTERN = /\b429\b|quota|rate.?limit|RESOURCE_EXHAUSTED/i;

export function toClientErrorMessage(message: string): string {
	return QUOTA_PATTERN.test(message) ? QUOTA_EXCEEDED : message;
}
