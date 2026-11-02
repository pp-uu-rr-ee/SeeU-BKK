import { expect, test } from "bun:test";
import { isAdmin } from "../roles";

test("admin comes from app_metadata only", () => {
  expect(isAdmin({ app_metadata: { role: "admin" } })).toBe(true);
  expect(isAdmin({ user_metadata: { role: "admin" } })).toBe(false);
  expect(isAdmin({ role: "admin" })).toBe(false);
  expect(isAdmin(null)).toBe(false);
});
