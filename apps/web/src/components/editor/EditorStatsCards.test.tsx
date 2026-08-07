import { describe, it, expect } from "vitest";
import { render, screen } from "@/test-utils";
import { EditorStatsCards } from "./EditorStatsCards";

describe("EditorStatsCards", () => {
  it("renders stats cards", () => {
    const stats = {
      articlesCount: 10,
      totalEdits: 120,
      editedArticlesCount: 15,
      charactersAdded: 5000,
      referencesAdded: 25,
      pageviews: 1000,
    };

    render(<EditorStatsCards stats={stats} />);

    expect(screen.getByTestId("editor-stats-cards")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("5,000")).toBeInTheDocument();
  });
});
