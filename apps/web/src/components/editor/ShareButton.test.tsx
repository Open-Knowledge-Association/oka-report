import { describe, it, expect } from "vitest";
import { render, screen } from "@/test-utils";
import { ShareButton } from "./ShareButton";

describe("ShareButton", () => {
  it("renders share button", () => {
    render(<ShareButton editorId="test-id" username="testuser" />);

    expect(screen.getByTestId("share-button")).toBeInTheDocument();
    expect(screen.getByText("Share")).toBeInTheDocument();
  });
});
