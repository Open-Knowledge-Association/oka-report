import { describe, it, expect } from "vitest";
import { render, screen } from "@/test-utils";
import { WikiDistributionChart } from "./WikiDistributionChart";

describe("WikiDistributionChart", () => {
  it("renders empty state when no articles", () => {
    render(<WikiDistributionChart articles={[]} />);

    expect(screen.getByTestId("wiki-distribution-chart-empty")).toBeInTheDocument();
  });

  it("renders chart with articles", () => {
    const articles = [
      { id: "1", title: "Article 1", wikiProject: "en.wikipedia.org" },
      { id: "2", title: "Article 2", wikiProject: "id.wikipedia.org" },
    ];

    render(<WikiDistributionChart articles={articles} />);

    expect(screen.getByTestId("wiki-distribution-chart")).toBeInTheDocument();
  });
});
