export interface OpeningHour {
	day_of_week: number; // 0 = Sunday
	open_time: string | null; // "HH:MM" or "HH:MM:SS"
	close_time: string | null;
	is_closed: boolean;
	note?: string | null;
}

/** "09:00:00" -> "09:00" */
export function formatTime(time: string | null): string {
	return time ? time.slice(0, 5) : "";
}

function toMinutes(time: string): number {
	const [h, m] = time.split(":").map(Number);
	return h * 60 + m;
}

/**
 * Whether a place is open at `now` given its weekly hours.
 * A close_time earlier than open_time means the place closes after midnight.
 * Returns null when no hours are known.
 */
export function isOpenAt(hours: OpeningHour[], now: Date): boolean | null {
	if (hours.length === 0) return null;
	const minutes = now.getHours() * 60 + now.getMinutes();
	const day = now.getDay();
	const today = hours.find((h) => h.day_of_week === day);
	const yesterday = hours.find((h) => h.day_of_week === (day + 6) % 7);

	// Still inside yesterday's overnight window (e.g. 18:00 - 02:00)
	if (yesterday && !yesterday.is_closed && yesterday.open_time && yesterday.close_time) {
		const open = toMinutes(yesterday.open_time);
		const close = toMinutes(yesterday.close_time);
		if (close < open && minutes < close) return true;
	}
	if (!today || today.is_closed || !today.open_time || !today.close_time) return false;
	const open = toMinutes(today.open_time);
	const close = toMinutes(today.close_time);
	return close < open ? minutes >= open : minutes >= open && minutes < close;
}
