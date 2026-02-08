import { createFileRoute } from "@tanstack/react-router";
import { HistoryPage } from "@/components/history/history-page";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/admin/history")({
  component: () => (
    <ProtectedRoute requiredRole="admin">
      <HistoryPage />
    </ProtectedRoute>
  ),
});
