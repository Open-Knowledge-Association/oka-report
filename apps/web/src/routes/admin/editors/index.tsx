import { createFileRoute, redirect } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/admin/editors/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/sync-jobs" });
  },
  component: () => (
    <ProtectedRoute requiredRole="admin">
      <div>Redirecting...</div>
    </ProtectedRoute>
  ),
});
