import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, FileText, BookOpen, HardDrive, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";

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
  const navigate = useNavigate();
  const {
    data: editorsData = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["stats", "editors"],
    queryFn: async () => {
      const data = await apiFetch<EditorStats[]>("/editors?school=OKA&slug=OKA");
      return data;
    },
  });

  const editors: EditorStats[] = editorsData;

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
            ? "Loading editors..."
            : error
              ? "Failed to load editors"
              : `Real-time stats for ${editors.length} OKA editors`}
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
                  No editors found.
                </TableCell>
              </TableRow>
            ) : (
              editors.map((editor) => (
                <TableRow key={editor.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate({ to: `/editors/${editor.id}` as any })}
                        className="hover:underline text-blue-600 cursor-pointer text-left"
                      >
                        {editor.username}
                      </button>
                      <a
                        href={`https://en.wikipedia.org/wiki/User:${editor.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View on Wikipedia"
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
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
