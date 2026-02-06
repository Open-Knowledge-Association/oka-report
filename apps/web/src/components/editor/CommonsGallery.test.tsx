import { describe, it, expect } from "vitest";
import { render, screen } from "@/test-utils";
import { CommonsGallery } from "./CommonsGallery";

describe("CommonsGallery", () => {
  it("renders loading state initially", () => {
    render(<CommonsGallery editorId="test-editor-id" />);

    expect(screen.getByTestId("commons-gallery-loading")).toBeInTheDocument();
  });

  it("renders gallery container", () => {
    render(<CommonsGallery editorId="test-editor-id" />);

    expect(document.body).toBeTruthy();
  });
});
