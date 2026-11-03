import { expect, test } from "bun:test";
import { localizedPlace, tagLabel } from "../place-locale";

const place = {
  name: "Wat Pho",
  description: "Temple of the Reclining Buddha",
  name_th: "วัดโพธิ์",
  description_th: "วัดพระเชตุพนฯ ที่ประดิษฐานพระพุทธไสยาส",
};

test("Thai mode uses the Thai name and description", () => {
  expect(localizedPlace(place, "th")).toEqual({ name: "วัดโพธิ์", description: "วัดพระเชตุพนฯ ที่ประดิษฐานพระพุทธไสยาส" });
});

test("English mode keeps the original fields", () => {
  expect(localizedPlace(place, "en")).toEqual({ name: "Wat Pho", description: "Temple of the Reclining Buddha" });
});

test("falls back to English when the Thai text is missing or blank", () => {
  expect(localizedPlace({ name: "Coin Museum", description: "Coins", name_th: " ", description_th: null }, "th")).toEqual({
    name: "Coin Museum",
    description: "Coins",
  });
  expect(localizedPlace({ name: "Coin Museum" }, "th")).toEqual({ name: "Coin Museum", description: "" });
});

test("tag labels follow the UI language", () => {
  expect(tagLabel("walking-street", "th")).toBe("ถนนคนเดิน");
  expect(tagLabel("walking-street", "en")).toBe("Walking street");
  expect(tagLabel(" Temple ", "th")).toBe("วัด");
});

test("unknown tags fall back to a readable version of the tag", () => {
  expect(tagLabel("rooftop-bar", "th")).toBe("Rooftop bar");
});
