import React, { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Custom render function that wraps components with necessary providers
 *
 * Provider order:
 * 1. QueryClientProvider - for React Query
 *
 * Usage:
 * ```tsx
 * const { getByTestId } = renderWithProviders(<MyComponent />)
 * ```
 */

export interface RenderWithProvidersOptions extends Omit<RenderOptions, "wrapper"> {
  /**
   * Custom QueryClient to use instead of creating a new one
   */
  queryClient?: QueryClient;
}

/**
 * Create a test QueryClient with disabled retries for faster tests
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Custom render function with QueryClientProvider wrapper
 */
export function renderWithProviders(
  ui: ReactElement,
  { queryClient, ...renderOptions }: RenderWithProvidersOptions = {},
) {
  const testQueryClient = queryClient || createTestQueryClient();

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={testQueryClient}>{children}</QueryClientProvider>;
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * data-testid Convention Documentation
 *
 * The following naming convention should be used for data-testid attributes:
 *
 * 1. Components: kebab-case following structure
 *    - Button: data-testid="submit-button"
 *    - Form: data-testid="editor-form"
 *    - Card: data-testid="stat-card"
 *
 * 2. List items: [list-name]-item-[index]
 *    - data-testid="editor-list-item-0"
 *    - data-testid="result-list-item-1"
 *
 * 3. Containers: [container-name]-container
 *    - data-testid="main-container"
 *    - data-testid="sidebar-container"
 *
 * 4. States: append state if relevant
 *    - data-testid="loading-spinner" (when loading)
 *    - data-testid="error-message" (when error)
 *    - data-testid="empty-state" (when empty)
 *
 * Example component:
 * ```tsx
 * export function UserProfile({ userId }) {
 *   return (
 *     <div data-testid="user-profile-container">
 *       <img data-testid="user-avatar" src={...} />
 *       <h1 data-testid="user-name">{name}</h1>
 *       <button data-testid="edit-button">Edit</button>
 *     </div>
 *   )
 * }
 *
 * // Test:
 * const { getByTestId } = renderWithProviders(<UserProfile userId="123" />)
 * expect(getByTestId('user-name')).toHaveTextContent('John Doe')
 * ```
 */

// Re-export everything from React Testing Library
export * from "@testing-library/react";
export { userEvent } from "@testing-library/user-event";
