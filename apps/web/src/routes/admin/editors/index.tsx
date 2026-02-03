import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fetchEditors } from "@/lib/api";
import type { Editor } from "@/lib/api";

export const Route = createFileRoute("/admin/editors/")({
  component: AdminEditorsPage,
});

function AdminEditorsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["editors"],
    queryFn: fetchEditors,
  });

  const editors: Editor[] = data ?? [];

  const handleExport = () => {
    const csv = [
      ["Username", "Status", "Source", "Created At"],
      ...editors.map((e) => [
        e.username,
        e.isActive ? "Active" : "Inactive",
        e.source,
        new Date(e.createdAt).toLocaleDateString(),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `editors-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Editor Management</h1>
          <p className="text-slate-600">Manage tracked Wikipedia editors</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" asChild>
            <a href="/admin/editors/import">
              <Upload className="mr-2 h-4 w-4" />
              Bulk Import
            </a>
          </Button>
          <Button asChild>
            <a href="/admin/editors/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Editor
            </a>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {editors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                    No editors found. Add your first editor to get started.
                  </TableCell>
                </TableRow>
              ) : (
                editors.map((editor) => (
                  <TableRow key={editor.id}>
                    <TableCell className="font-medium">{editor.username}</TableCell>
                    <TableCell>
                      <Badge variant={editor.isActive ? "default" : "secondary"}>
                        {editor.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{editor.source}</TableCell>
                    <TableCell>{new Date(editor.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
