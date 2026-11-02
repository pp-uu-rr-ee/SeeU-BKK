import { expect, test } from "bun:test";
import { MAX_PLACE_IMAGE_BYTES, imageExtensionFor, placeImagePath, uploadedPlaceImagePath } from "../image-files";

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
test("uploaded place images get a unique path under places/uploads", () => {
  expect(uploadedPlaceImagePath("webp", "123e4567")).toBe("places/uploads/123e4567.webp");
  const a = uploadedPlaceImagePath("jpg");
  expect(a).toMatch(/^places\/uploads\/[0-9a-f-]{36}\.jpg$/);
  expect(uploadedPlaceImagePath("jpg")).not.toBe(a);
});
test("caps uploads at 5MB", () => {
  expect(MAX_PLACE_IMAGE_BYTES).toBe(5 * 1024 * 1024);
});
