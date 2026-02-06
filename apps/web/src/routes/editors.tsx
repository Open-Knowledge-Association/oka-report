import { createFileRoute, Link } from "@tanstack/react-router";
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

type EditorStats = {
  id: string;
  username: string;
  characterSum: number;
  referencesCount: number;
  uploadsCount: number;
};

type StatsTotals = {
  characters: number;
  references: number;
  uploads: number;
};

export const Route = createFileRoute("/editors")({
  component: EditorsStatsPage,
});

function EditorsStatsPage() {
  const { data: outreachUsers = [], isLoading } = useQuery({
    queryKey: ["stats", "editors"],
    queryFn: fetchOutreachUsers,
  });

  // Filter for students only (role === 0)
  const students: OutreachUser[] = outreachUsers.filter((u) => u.role === 0);

  // Transform Outreach API response to match table format
  const editors: EditorStats[] = students.map((user, index) => ({
    id: `outreach-${user.id}`,
    username: user.username,
    characterSum: user.character_sum_ms || 0,
    referencesCount: user.references_count || 0,
    uploadsCount: user.total_uploads || 0,
  }));

  const totalStats = editors.reduce<StatsTotals>(
    (acc, editor) => ({
      characters: acc.characters + (editor.characterSum || 0),
      references: acc.references + (editor.referencesCount || 0),
      uploads: acc.uploads + (editor.uploadsCount || 0),
    }),
    { characters: 0, references: 0, uploads: 0 },
  );

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Editor Statistics</h1>
        <p className="text-slate-600 mt-1">
          {isLoading
            ? "Loading editors from Outreach Dashboard..."
            : `Real-time stats for ${editors.length} OKA students from Outreach Dashboard`}
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
                  No editors found. Check your Outreach Dashboard connection.
                </TableCell>
              </TableRow>
            ) : (
              editors.map((editor) => (
                <TableRow key={editor.id}>
                  <TableCell className="font-medium">
                    <a
                      href={`https://en.wikipedia.org/wiki/User:${editor.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline text-blue-600"
                    >
                      {editor.username}
                    </a>
                  </TableCell>
                  <TableCell className="text-right">
                    {editor.characterSum.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {editor.referencesCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {editor.uploadsCount.toLocaleString()}
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
