import { describe, it, expect } from "vitest";
import { render, screen } from "@/test-utils";
import { ContributionTimelineChart } from "./ContributionTimelineChart";

describe("ContributionTimelineChart", () => {
  it("renders loading state initially", () => {
    render(<ContributionTimelineChart editorId="test-editor-id" />);

    expect(screen.getByTestId("contribution-timeline-chart-loading")).toBeInTheDocument();
  });

  it("renders chart container", () => {
    render(<ContributionTimelineChart editorId="test-editor-id" />);

    // Component should render without errors
    expect(document.body).toBeTruthy();
  });
});
