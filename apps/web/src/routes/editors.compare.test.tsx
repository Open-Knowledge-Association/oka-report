import { describe, it, expect } from "vitest";
import { render, screen } from "@/test-utils";
import { CompareEditorsPage } from "./editors.compare";

describe("CompareEditorsPage", () => {
  it("renders empty state when no ids provided", () => {
    render(<CompareEditorsPage />);

    expect(screen.getByText("Select 2 editors")).toBeInTheDocument();
    expect(screen.getByText("Browse Editors")).toBeInTheDocument();
  });
});
