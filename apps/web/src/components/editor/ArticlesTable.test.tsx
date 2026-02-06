import { describe, it, expect } from "vitest";
import { render, screen } from "@/test-utils";
import { ArticlesTable } from "./ArticlesTable";

describe("ArticlesTable", () => {
  it("renders empty state when no articles", () => {
    render(<ArticlesTable articles={[]} />);

    expect(screen.getByTestId("articles-table-empty")).toBeInTheDocument();
  });

  it("renders table with articles", () => {
    const articles = [
      {
        id: "1",
        title: "Test Article",
        url: "https://example.com",
        wikiProject: "en.wikipedia.org",
        characterSum: 1000,
        referencesCount: 5,
      },
    ];

    render(<ArticlesTable articles={articles} />);

    expect(screen.getByTestId("articles-table")).toBeInTheDocument();
    expect(screen.getByText("Test Article")).toBeInTheDocument();
  });

  it("renders search input", () => {
    const articles = [
      {
        id: "1",
        title: "Test Article",
        url: "https://example.com",
        wikiProject: "en.wikipedia.org",
        characterSum: 1000,
        referencesCount: 5,
      },
    ];

    render(<ArticlesTable articles={articles} />);

    expect(screen.getByTestId("article-search")).toBeInTheDocument();
  });
});
