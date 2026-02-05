import { describe, it, expect } from "vitest";
import { normalizeWikiProject, parseWikiProject, extractFromUrl } from "./wiki-project";

describe("normalizeWikiProject", () => {
  it("converts en + wikipedia to en.wikipedia.org", () => {
    expect(normalizeWikiProject("en", "wikipedia")).toBe("en.wikipedia.org");
  });

  it("converts id + wikipedia to id.wikipedia.org", () => {
    expect(normalizeWikiProject("id", "wikipedia")).toBe("id.wikipedia.org");
  });

  it("handles commons", () => {
    expect(normalizeWikiProject("commons", "wikimedia")).toBe("commons.wikimedia.org");
  });
});

describe("parseWikiProject", () => {
  it("parses en.wikipedia.org correctly", () => {
    expect(parseWikiProject("en.wikipedia.org")).toEqual({ language: "en", project: "wikipedia" });
  });

  it("parses id.wikipedia.org correctly", () => {
    expect(parseWikiProject("id.wikipedia.org")).toEqual({ language: "id", project: "wikipedia" });
  });

  it("throws on invalid format", () => {
    expect(() => parseWikiProject("invalid")).toThrow();
  });
});

describe("extractFromUrl", () => {
  it("extracts from standard Wikipedia URL", () => {
    const result = extractFromUrl("https://en.wikipedia.org/wiki/Test_Article");
    expect(result).toEqual({ wikiProject: "en.wikipedia.org", title: "Test_Article" });
  });

  it("handles encoded URLs", () => {
    const result = extractFromUrl("https://en.wikipedia.org/wiki/Test%20Article");
    expect(result).toEqual({ wikiProject: "en.wikipedia.org", title: "Test Article" });
  });

  it("throws on invalid URL", () => {
    expect(() => extractFromUrl("invalid")).toThrow();
  });
});
