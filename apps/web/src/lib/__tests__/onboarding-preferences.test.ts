import { expect, test } from "bun:test";
import { EMPTY_ONBOARDING_PREFERENCES, toOnboardingPreferences } from "../onboarding-preferences";

test("keeps saved answers so Edit Survey can prefill them", () => {
  const saved = {
    vibes: ["v1", "v4"],
    travelStyle: "archivist",
    pace: 70,
    transit: ["River Ferries"],
    culinary: ["Street Carts"],
    boundaries: ["Tourist Traps"],
  };
  expect(toOnboardingPreferences(saved)).toEqual(saved);
});

test("falls back to empty answers for missing or malformed fields", () => {
  expect(toOnboardingPreferences(null)).toEqual(EMPTY_ONBOARDING_PREFERENCES);
  expect(
    toOnboardingPreferences({ vibes: "v1", travelStyle: 3, pace: "fast", transit: ["BTS", 5] })
  ).toEqual({ ...EMPTY_ONBOARDING_PREFERENCES, transit: ["BTS"] });
});

test("clamps pace to the slider range", () => {
  expect(toOnboardingPreferences({ pace: 140 }).pace).toBe(100);
  expect(toOnboardingPreferences({ pace: -5 }).pace).toBe(0);
});
