import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/editors/import")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/sync-jobs" });
  },
  component: () => <div>Redirecting...</div>,
});
