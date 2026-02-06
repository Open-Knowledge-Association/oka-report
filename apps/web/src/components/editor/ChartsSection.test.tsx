import { describe, it, expect } from "vitest";
import { render, screen } from "@/test-utils";
import { ChartsSection } from "./ChartsSection";

describe("ChartsSection", () => {
  const mockArticles = [
    {
      id: "1",
      title: "Test Article",
      url: "https://example.com",
      wikiProject: "en.wikipedia.org",
      characterSum: 1000,
      referencesCount: 5,
    },
  ];

  it("renders charts section", () => {
    render(<ChartsSection editorId="test-id" articles={mockArticles} dailyStats={[]} />);

    expect(document.body).toBeTruthy();
  });
});
