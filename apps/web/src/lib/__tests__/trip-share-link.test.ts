import { expect, test } from "bun:test";
import { sharedTripUrl } from "../trip-share-link";

test("builds the public link from the share token, not the trip id", () => {
  expect(sharedTripUrl("https://seeu.example", "3f1c2a9e-7b6d-4c1e-9a8f-2b3c4d5e6f70")).toBe(
    "https://seeu.example/trips/shared/3f1c2a9e-7b6d-4c1e-9a8f-2b3c4d5e6f70"
  );
});

test("does not double the slash when the origin ends with one", () => {
  expect(sharedTripUrl("http://localhost:3001/", "abc")).toBe("http://localhost:3001/trips/shared/abc");
});
