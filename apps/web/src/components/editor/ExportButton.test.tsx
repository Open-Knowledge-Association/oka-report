import { describe, it, expect } from "vitest";
import { render, screen } from "@/test-utils";
import { ExportButton } from "./ExportButton";

describe("ExportButton", () => {
  const mockProfile = {
    editor: {
      id: "1",
      username: "testuser",
      wiki: "en.wikipedia",
    },
    outreachStats: {
      articlesCount: 5,
      totalEdits: 10,
      charactersAdded: 1000,
      referencesAdded: 20,
      pageviews: 500,
    },
    articles: [],
  };

  it("renders export button", () => {
    render(<ExportButton profile={mockProfile} />);

    expect(screen.getByTestId("export-button")).toBeInTheDocument();
    expect(screen.getByText("Export CSV")).toBeInTheDocument();
  });
});
