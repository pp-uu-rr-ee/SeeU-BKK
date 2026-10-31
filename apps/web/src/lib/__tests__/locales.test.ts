import { expect, test } from "bun:test";
import en from "../../locales/en.json";
import th from "../../locales/th.json";

const keys = (o: unknown, p = ""): string[] =>
  o && typeof o === "object" && !Array.isArray(o)
    ? Object.entries(o).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k))
    : [p];

test("en and th define the same keys", () => {
  expect(keys(th).sort()).toEqual(keys(en).sort());
});
