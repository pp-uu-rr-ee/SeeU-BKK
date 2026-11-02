import { expect, test } from "bun:test";
import { hasRole } from "../roles";

test("grants a role only from app_metadata (which users cannot edit)", () => {
  expect(hasRole({ app_metadata: { role: "admin" } }, "admin")).toBe(true);
  expect(hasRole({ app_metadata: { role: "editor" } }, "admin")).toBe(false);
});

test("ignores user_metadata.role, which any user can set on themselves", () => {
  expect(hasRole({ user_metadata: { role: "admin" } }, "admin")).toBe(false);
});

test("ignores the auth role claim (it must stay a real Postgres role like 'authenticated')", () => {
  expect(hasRole({ role: "admin" }, "admin")).toBe(false);
  expect(hasRole(null, "admin")).toBe(false);
});
