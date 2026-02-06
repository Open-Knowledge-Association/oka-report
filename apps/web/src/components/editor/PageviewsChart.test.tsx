import { describe, it, expect } from "vitest";
import { render, screen } from "@/test-utils";
import { PageviewsChart } from "./PageviewsChart";

describe("PageviewsChart", () => {
  it("renders empty state when no articles", () => {
    render(<PageviewsChart articles={[]} />);

    expect(screen.getByTestId("pageviews-chart-empty")).toBeInTheDocument();
  });

  it("renders chart when articles have pageviews", () => {
    const articles = [
      {
        id: "1",
        title: "Test Article",
        url: "https://example.com",
        characterSum: 1000,
        referencesCount: 5,
        pageviews: [{ type: "DAILY", views: 100, date: "2024-01-01" }],
      },
    ];

    render(<PageviewsChart articles={articles} />);

    expect(screen.getByTestId("pageviews-chart")).toBeInTheDocument();
  });
});
