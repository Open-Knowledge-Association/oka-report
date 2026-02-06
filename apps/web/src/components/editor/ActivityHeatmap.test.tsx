import { describe, it, expect } from "vitest";
import { render, screen } from "@/test-utils";
import { ActivityHeatmap } from "./ActivityHeatmap";

describe("ActivityHeatmap", () => {
  it("renders empty state when no data", () => {
    render(<ActivityHeatmap dailyStats={[]} />);

    expect(screen.getByTestId("activity-heatmap-empty")).toBeInTheDocument();
  });

  it("renders heatmap with data", () => {
    const stats = [
      {
        date: "2024-01-01",
        edits: 5,
        wordsAdded: 100,
        articlesCreated: 0,
        articlesEdited: 1,
        referencesAdded: 2,
        commonsUploads: 0,
      },
      {
        date: "2024-01-02",
        edits: 10,
        wordsAdded: 200,
        articlesCreated: 1,
        articlesEdited: 2,
        referencesAdded: 3,
        commonsUploads: 0,
      },
    ];

    render(<ActivityHeatmap dailyStats={stats} />);

    expect(screen.getByTestId("activity-heatmap")).toBeInTheDocument();
  });
});
