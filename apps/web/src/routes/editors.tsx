import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/editors")({
  component: EditorsLayout,
});

function EditorsLayout() {
  return <Outlet />;
}
