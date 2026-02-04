import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, FileText, BookOpen, HardDrive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchOutreachUsers, type OutreachUser } from "@/lib/api";

type OutreachUserStats = OutreachUser;
type OutreachStatsTotals = {
  characters: number;
  references: number;
  uploads: number;
};

export const Route = createFileRoute("/editors")({
  component: EditorsStatsPage,
});

function EditorsStatsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["stats", "editors"],
    queryFn: fetchOutreachUsers,
  });

  const editors: OutreachUserStats[] = data ?? [];

  const totalStats = editors.reduce<OutreachStatsTotals>(
    (acc, editor) => ({
      characters: acc.characters + (editor.character_sum_ms || 0),
      references: acc.references + (editor.references_count || 0),
      uploads: acc.uploads + (editor.total_uploads || 0),
    }),
    { characters: 0, references: 0, uploads: 0 },
  );

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Editor Statistics</h1>
        <p className="text-slate-600 mt-1">Detailed stats for each tracked editor</p>
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
            <CardTitle className="text-sm font-medium">Characters Added</CardTitle>
            <FileText className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.characters.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">References Added</CardTitle>
            <BookOpen className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.references.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Uploads</CardTitle>
            <HardDrive className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.uploads.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead className="text-right">Characters Added</TableHead>
              <TableHead className="text-right">References Added</TableHead>
              <TableHead className="text-right">Total Uploads</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : editors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                  No editor statistics available.
                </TableCell>
              </TableRow>
            ) : (
              editors.map((editor) => (
                <TableRow key={editor.id}>
                  <TableCell className="font-medium">
                    <a
                      href={editor.contribution_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {editor.username}
                    </a>
                  </TableCell>
                  <TableCell className="text-right">
                    {editor.character_sum_ms.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {editor.references_count.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {editor.total_uploads.toLocaleString()}
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
