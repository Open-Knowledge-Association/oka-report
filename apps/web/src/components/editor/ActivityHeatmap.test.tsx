import { describe, it, expect } from "vitest";
import { render, screen } from "@/test-utils";
import { ActivityHeatmap } from "./ActivityHeatmap";

describe("ActivityHeatmap", () => {
  it("renders empty state when no data", () => {
    render(<ActivityHeatmap dailyStats={[]} />);

    expect(screen.getByTestId("activity-heatmap-empty")).toBeInTheDocument();
  });

  it("renders heatmap with data", () => {
    const today = new Date().toISOString().slice(0, 10);
    const stats = [
      {
        date: today,
        edits: 5,
        wordsAdded: 100,
        articlesCreated: 0,
        articlesEdited: 1,
        referencesAdded: 2,
        commonsUploads: 0,
      },
    ];

    render(<ActivityHeatmap dailyStats={stats} />);

    expect(screen.getByTestId("activity-heatmap")).toBeInTheDocument();
  });

  it("renders an empty state when all data is older than one year", () => {
    render(
      <ActivityHeatmap
        dailyStats={[
          {
            date: "2020-01-01",
            edits: 5,
            wordsAdded: 100,
            articlesCreated: 0,
            articlesEdited: 1,
            referencesAdded: 2,
            commonsUploads: 0,
          },
        ]}
      />,
    );

    expect(screen.getByTestId("activity-heatmap-empty")).toBeInTheDocument();
  });
});
