import { expect, test } from "bun:test";
import { imageExtensionFor, placeImagePath } from "../image-files";

test("maps image content types", () => {
  expect(imageExtensionFor("image/jpeg")).toBe("jpg");
  expect(imageExtensionFor("image/webp; charset=binary")).toBe("webp");
});
test("rejects non-images", () => {
  expect(imageExtensionFor("text/html; charset=utf-8")).toBeNull();
  expect(imageExtensionFor(null)).toBeNull();
});
test("builds the object path", () => {
  expect(placeImagePath("wat-pho", "jpg")).toBe("places/wat-pho.jpg");
});
