import { describe, expect, test } from "bun:test";
import { buildPlaceEmbeddingText, categoriesToTags, placeSearchFilter, sanitizeSearchTerm } from "../place-search";

describe("sanitizeSearchTerm", () => {
  test("strips PostgREST filter syntax", () => {
    expect(sanitizeSearchTerm('a),id.eq.(x')).toBe("a id.eq. x");
    expect(sanitizeSearchTerm('wat "pho", 100%')).toBe("wat pho 100");
  });
  test("keeps Thai text", () => {
    expect(sanitizeSearchTerm("  วัด  โพธิ์ ")).toBe("วัด โพธิ์");
  });
});

describe("placeSearchFilter", () => {
  test("ORs name/description in both languages", () => {
    expect(placeSearchFilter("wat")).toBe(
      "name.ilike.%wat%,description.ilike.%wat%,name_th.ilike.%wat%,description_th.ilike.%wat%"
    );
  });
  test("returns null when nothing searchable remains", () => {
    expect(placeSearchFilter(",(%)")).toBeNull();
  });
});

describe("categoriesToTags", () => {
  test("maps UI categories to stored tags and dedupes", () => {
    expect(categoriesToTags("restaurant,temple")).toEqual(["food", "restaurant", "temple"]);
    expect(categoriesToTags(["all", "", "Shopping"])).toEqual(["market", "mall", "walking-street", "shopping"]);
  });
  test("handles undefined", () => {
    expect(categoriesToTags(undefined)).toEqual([]);
  });
});

describe("buildPlaceEmbeddingText", () => {
  test("includes Thai fields only when present", () => {
    const text = buildPlaceEmbeddingText({ name: "Wat Pho", name_th: "วัดโพธิ์", tags: ["temple"], price: 300 });
    expect(text).toContain("Thai name: วัดโพธิ์");
    expect(text).toContain("Price: 300 Baht");
    expect(buildPlaceEmbeddingText({ name: "Sanam Luang" })).not.toContain("Thai name");
  });
});
