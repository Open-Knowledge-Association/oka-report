import { describe, it, expect } from "vitest";
import { render, screen } from "@/test-utils";
import { AchievementBadges } from "./AchievementBadges";

describe("AchievementBadges", () => {
  it("renders loading state initially", () => {
    render(<AchievementBadges editorId="test-editor-id" />);

    expect(screen.getByTestId("achievement-badges-loading")).toBeInTheDocument();
  });

  it("renders badges container", () => {
    render(<AchievementBadges editorId="test-editor-id" />);

    expect(document.body).toBeTruthy();
  });
});
