import { createFileRoute } from "@tanstack/react-router";
import { HistoryPage } from "@/components/history/history-page";

export const Route = createFileRoute("/admin/history")({
  component: HistoryPage,
});
