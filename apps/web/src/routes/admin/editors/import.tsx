import { createFileRoute, redirect } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/admin/editors/import")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/sync-jobs" });
  },
  component: () => (
    <ProtectedRoute requiredRole="admin">
      <div>Redirecting...</div>
    </ProtectedRoute>
  ),
});
