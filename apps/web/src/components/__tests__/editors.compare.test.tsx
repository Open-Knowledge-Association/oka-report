import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@/test-utils";
import { CompareEditorsPage } from "../../routes/editors.compare";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useSearch: () => ({}),
    Link: ({ children }: { children: React.ReactNode }) => <a href="/editors">{children}</a>,
  };
});

describe("CompareEditorsPage", () => {
  it("renders empty state when no ids provided", () => {
    render(<CompareEditorsPage />);

    expect(screen.getByText(/Select 2 editors to compare/)).toBeInTheDocument();
    expect(screen.getByText("Browse Editors")).toBeInTheDocument();
  });
});
