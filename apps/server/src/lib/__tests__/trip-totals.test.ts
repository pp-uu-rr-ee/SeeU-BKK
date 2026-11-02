import { afterEach, beforeEach, describe, expect, test } from "bun:test";

const originalFetch = globalThis.fetch;
const originalEnv = {
	SUPABASE_URL: process.env.SUPABASE_URL,
	SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
	SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
	MAPBOX_ACCESS_TOKEN: process.env.MAPBOX_ACCESS_TOKEN,
	NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
};

const watArun = { lat: 13.7437, lng: 100.4889 };
const watPho = { lat: 13.7465, lng: 100.493 };
const grandPalace = { lat: 13.75, lng: 100.4913 };

describe("computeTripTotals", () => {
	const fetchCalls: string[] = [];

	beforeEach(() => {
		process.env.SUPABASE_URL = "https://example.supabase.co";
		process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
		process.env.SUPABASE_ANON_KEY = "anon-key";
		process.env.MAPBOX_ACCESS_TOKEN = "pk.test-token";
		process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = "pk.test-token";
		fetchCalls.length = 0;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		for (const [key, value] of Object.entries(originalEnv)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	});

	test("uses Mapbox walking legs for distance and adds travel time to stop time", async () => {
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = String(input);
			fetchCalls.push(url);
			return new Response(
				JSON.stringify({
					code: "Ok",
					routes: [
						{
							distance: 2100,
							duration: 1500,
							legs: [
								{ distance: 1300, duration: 900 },
								{ distance: 800, duration: 600 },
							],
						},
					],
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		}) as typeof fetch;

		const { computeTripTotals } = await import("../trip-totals");
		const totals = await computeTripTotals([
			{ ...watArun, suggested_time_min: 60 },
			{ ...watPho, suggested_time_min: 90 },
			{ ...grandPalace },
		]);

		expect(fetchCalls.some((url) => url.includes("directions/v5/mapbox/walking"))).toBe(true);
		expect(totals.legs_km).toEqual([0, 1.3, 0.8]);
		expect(totals.total_distance_km).toBe(2.1);
		// 60 + 90 + 60 (default) stop time + 25 min walking
		expect(totals.total_minutes).toBe(235);
	});

	test("falls back to straight-line distance and stop time only when Mapbox fails", async () => {
		globalThis.fetch = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;

		const { computeTripTotals } = await import("../trip-totals");
		const totals = await computeTripTotals([
			{ ...watArun, suggested_time_min: 45 },
			{ ...watPho, suggested_time_min: 30 },
		]);

		expect(totals.legs_km[0]).toBe(0);
		expect(totals.legs_km[1]).toBeGreaterThan(0.4);
		expect(totals.legs_km[1]).toBeLessThan(0.7);
		expect(totals.total_distance_km).toBe(totals.legs_km[1]!);
		expect(totals.total_minutes).toBe(75);
	});

	test("skips stops without coordinates and does not call Mapbox for a single stop", async () => {
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			fetchCalls.push(String(input));
			return new Response("{}", { status: 200 });
		}) as typeof fetch;

		const { computeTripTotals } = await import("../trip-totals");
		const totals = await computeTripTotals([
			{ ...watArun, suggested_time_min: 60 },
			{ lat: null, lng: null, suggested_time_min: 30 },
		]);

		expect(fetchCalls).toHaveLength(0);
		expect(totals).toEqual({ legs_km: [0, 0], total_distance_km: 0, total_minutes: 90 });
	});
});
