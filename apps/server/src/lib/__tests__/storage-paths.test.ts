import { describe, expect, test } from "bun:test";
import {
  avatarStoragePath,
  placeImageStoragePath,
  replacedAvatarPath,
  replacedPlaceImagePath,
} from "../storage-paths";

const base = "https://ihdcpucmdyprgbykbuvs.supabase.co/storage/v1/object/public/user-uploads/";
test("extracts our avatar object path", () => {
  expect(avatarStoragePath(base + "avatars/x_1.png")).toBe("avatars/x_1.png");
});
test("ignores external, non-avatar and empty URLs", () => {
  expect(avatarStoragePath("https://example.com/a.png")).toBeNull();
  expect(avatarStoragePath(base + "other/x.png")).toBeNull();
  expect(avatarStoragePath("")).toBeNull();
  expect(avatarStoragePath(null)).toBeNull();
});

describe("replacedAvatarPath", () => {
  const old = base + "avatars/old.png";
  test("returns the old path when the avatar changed and no one else uses it", () => {
    expect(replacedAvatarPath(old, base + "avatars/new.png", false)).toBe("avatars/old.png");
    expect(replacedAvatarPath(old, null, false)).toBe("avatars/old.png");
  });
  test("never deletes a file another profile still points at", () => {
    expect(replacedAvatarPath(old, base + "avatars/new.png", true)).toBeNull();
  });
  test("never deletes an unchanged or external avatar", () => {
    expect(replacedAvatarPath(old, old, false)).toBeNull();
    expect(replacedAvatarPath("https://example.com/a.png", null, false)).toBeNull();
  });
});

describe("place images", () => {
  const base = "https://proj.supabase.co/storage/v1/object/public/place-images/";

  test("placeImageStoragePath returns the object path only for images we host", () => {
    expect(placeImageStoragePath(`${base}places/uploads/abc.webp`)).toBe("places/uploads/abc.webp");
    expect(placeImageStoragePath(`${base}places/wat-pho.jpg?v=2`)).toBe("places/wat-pho.jpg");
    expect(placeImageStoragePath("https://upload.wikimedia.org/a.jpg")).toBeNull();
    expect(placeImageStoragePath("https://proj.supabase.co/storage/v1/object/public/user-uploads/avatars/x.png")).toBeNull();
    expect(placeImageStoragePath(`${base}`)).toBeNull();
    expect(placeImageStoragePath(null)).toBeNull();
  });

  test("replacedPlaceImagePath only frees our own file when nothing else uses it", () => {
    const old = `${base}places/uploads/old.jpg`;
    expect(replacedPlaceImagePath(old, `${base}places/uploads/new.jpg`, false)).toBe("places/uploads/old.jpg");
    expect(replacedPlaceImagePath(old, old, false)).toBeNull();
    expect(replacedPlaceImagePath(old, "", true)).toBeNull();
    expect(replacedPlaceImagePath("https://upload.wikimedia.org/a.jpg", "", false)).toBeNull();
  });
});
