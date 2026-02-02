import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, FileText, TrendingUp, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchEditorStats } from "@/lib/api";

export const Route = createFileRoute("/editors")({
  component: EditorsStatsPage,
});

function EditorsStatsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["stats", "editors"],
    queryFn: fetchEditorStats,
  });

  const editors = data?.data || [];

  const totalStats = editors.reduce(
    (acc, editor) => ({
      edits: acc.edits + (editor.edits || 0),
      articlesCreated: acc.articlesCreated + (editor.articlesCreated || 0),
      articlesModified: acc.articlesModified + (editor.articlesModified || 0),
      pageviews: acc.pageviews + (editor.pageviews || 0),
    }),
    { edits: 0, articlesCreated: 0, articlesModified: 0, pageviews: 0 }
  );

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Editor Statistics</h1>
        <p className="text-slate-600 mt-1">
          Detailed stats for each tracked editor
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Editors</CardTitle>
            <Users className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{editors.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Edits</CardTitle>
            <TrendingUp className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalStats.edits.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Articles Created</CardTitle>
            <FileText className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalStats.articlesCreated.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Page Views</CardTitle>
            <Eye className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalStats.pageviews
                ? `${(totalStats.pageviews / 1000).toFixed(1)}K`
                : "0"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead className="text-right">Edits</TableHead>
              <TableHead className="text-right">Articles Created</TableHead>
              <TableHead className="text-right">Articles Modified</TableHead>
              <TableHead className="text-right">Page Views</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : editors.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-slate-500"
                >
                  No editor statistics available.
                </TableCell>
              </TableRow>
            ) : (
              editors.map((editor) => (
                <TableRow key={editor.editorId}>
                  <TableCell className="font-medium">{editor.username}</TableCell>
                  <TableCell className="text-right">
                    {editor.edits?.toLocaleString() || 0}
                  </TableCell>
                  <TableCell className="text-right">
                    {editor.articlesCreated?.toLocaleString() || 0}
                  </TableCell>
                  <TableCell className="text-right">
                    {editor.articlesModified?.toLocaleString() || 0}
                  </TableCell>
                  <TableCell className="text-right">
                    {editor.pageviews?.toLocaleString() || 0}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
