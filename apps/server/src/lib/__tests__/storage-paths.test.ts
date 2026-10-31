import { describe, expect, test } from "bun:test";
import { avatarStoragePath, replacedAvatarPath } from "../storage-paths";

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
