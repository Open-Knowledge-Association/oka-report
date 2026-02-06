/**
 * Example component for testing test-utils setup
 * This component demonstrates best practices for data-testid usage
 */

import React from "react";

interface HelloProps {
  name: string;
}

export function Hello({ name }: HelloProps) {
  return (
    <div data-testid="hello-container">
      <h1 data-testid="hello-heading">Hello, {name}!</h1>
      <p data-testid="hello-message">Welcome to the test infrastructure</p>
    </div>
  );
}
