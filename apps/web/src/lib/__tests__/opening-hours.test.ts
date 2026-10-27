import { describe, expect, test } from "bun:test";
import { formatTime, isOpenAt, type OpeningHour } from "../opening-hours";

// 2026-10-26 is a Monday (day_of_week 1)
const at = (day: number, time: string) => {
	const [h, m] = time.split(":").map(Number);
	return new Date(2026, 9, 25 + day, h, m);
};

const daily = (open: string, close: string): OpeningHour[] =>
	[0, 1, 2, 3, 4, 5, 6].map((d) => ({ day_of_week: d, open_time: open, close_time: close, is_closed: false }));

describe("isOpenAt", () => {
	test("returns null when no hours are known", () => {
		expect(isOpenAt([], at(1, "10:00"))).toBeNull();
	});

	test("regular daytime hours", () => {
		const hours = daily("08:00:00", "18:30:00");
		expect(isOpenAt(hours, at(1, "07:59"))).toBe(false);
		expect(isOpenAt(hours, at(1, "08:00"))).toBe(true);
		expect(isOpenAt(hours, at(1, "18:29"))).toBe(true);
		expect(isOpenAt(hours, at(1, "18:30"))).toBe(false);
	});

	test("closed day and missing day", () => {
		const hours: OpeningHour[] = [
			{ day_of_week: 1, open_time: null, close_time: null, is_closed: true },
			{ day_of_week: 2, open_time: "09:00", close_time: "17:00", is_closed: false },
		];
		expect(isOpenAt(hours, at(1, "12:00"))).toBe(false);
		expect(isOpenAt(hours, at(3, "12:00"))).toBe(false);
		expect(isOpenAt(hours, at(2, "12:00"))).toBe(true);
	});

	test("overnight hours carry into the next morning", () => {
		const hours: OpeningHour[] = [
			{ day_of_week: 5, open_time: "18:00", close_time: "02:00", is_closed: false },
		];
		expect(isOpenAt(hours, at(5, "17:00"))).toBe(false);
		expect(isOpenAt(hours, at(5, "23:00"))).toBe(true);
		expect(isOpenAt(hours, at(6, "01:30"))).toBe(true);
		expect(isOpenAt(hours, at(6, "02:30"))).toBe(false);
	});
});

test("formatTime trims seconds", () => {
	expect(formatTime("09:00:00")).toBe("09:00");
	expect(formatTime(null)).toBe("");
});
