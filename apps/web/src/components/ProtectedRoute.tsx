import { useAuth } from "@/lib/auth";
import type { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: "viewer" | "editor" | "admin";
  fallback?: ReactNode;
}

export function ProtectedRoute({
  children,
  requiredRole = "viewer",
  fallback,
}: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (fallback) return fallback;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-slate-600">Please sign in to access this page</div>
        <a
          href="/api/auth/google"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Sign in with Google
        </a>
      </div>
    );
  }

  const roleHierarchy = { viewer: 1, editor: 2, admin: 3 };
  const userRoleLevel = roleHierarchy[user!.role];
  const requiredRoleLevel = roleHierarchy[requiredRole];

  if (userRoleLevel < requiredRoleLevel) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-slate-900">403</h1>
          <p className="mt-2 text-slate-600">You don't have permission to access this page.</p>
          <a href="/" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
            Go back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return children;
}
