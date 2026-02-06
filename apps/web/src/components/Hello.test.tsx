import { describe, it, expect } from "vitest";
import { renderWithProviders, screen } from "../test-utils";
import { Hello } from "./Hello";

describe("Hello Component", () => {
  it("renders with the provided name", () => {
    renderWithProviders(<Hello name="World" />);

    const heading = screen.getByTestId("hello-heading");
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent("Hello, World!");
  });

  it("displays the welcome message", () => {
    renderWithProviders(<Hello name="Alice" />);

    const message = screen.getByTestId("hello-message");
    expect(message).toBeInTheDocument();
    expect(message).toHaveTextContent("Welcome to the test infrastructure");
  });

  it("contains the hello container", () => {
    renderWithProviders(<Hello name="Bob" />);

    const container = screen.getByTestId("hello-container");
    expect(container).toBeInTheDocument();
  });
});
