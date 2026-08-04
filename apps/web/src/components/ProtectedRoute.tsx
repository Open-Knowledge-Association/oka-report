import type { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: "viewer" | "editor" | "admin";
  fallback?: ReactNode;
  allowUnauthenticated?: boolean;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  // Public-open deployment: page access is intentionally unauthenticated.
  return children;
}
