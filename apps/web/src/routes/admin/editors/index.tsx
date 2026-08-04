import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/editors/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/sync-jobs" });
  },
  component: () => <div>Redirecting...</div>,
});
