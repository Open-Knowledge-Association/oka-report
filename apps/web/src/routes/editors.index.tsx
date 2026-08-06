import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Users, FileText, BookOpen, HardDrive, ExternalLink, GitCompare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchSnapshotEditors, PROGRAM_START_DATE, type EditorActivityDetail } from "@/lib/api";

export const Route = createFileRoute("/editors/")({
  component: EditorsStatsPage,
});

const SummaryCard = ({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  icon: any;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
      <Icon className="h-4 w-4 text-slate-400" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
    </CardContent>
  </Card>
);

function EditorsStatsPage() {
  const navigate = useNavigate();
  const [selectedEditors, setSelectedEditors] = useState<string[]>([]);

  const { data: editorsData = [], isLoading, error } = useQuery<EditorActivityDetail[]>({
    queryKey: ["snapshot-editors", "lifetime"],
    queryFn: () => fetchSnapshotEditors("YEAR", PROGRAM_START_DATE, new Date().toISOString()),
  });

  const editors: EditorActivityDetail[] = editorsData;
  const totalWords = editors.reduce((s, e) => s + e.wordsAdded, 0);
  const totalUploads = editors.reduce((s, e) => s + e.commonsUploads, 0);

  const toggleEditorSelection = (id: string) => {
    setSelectedEditors((prev) => {
      if (prev.includes(id)) {
        return prev.filter((editorId) => editorId !== id);
      }
      if (prev.length >= 2) {
        return [prev[1], id];
      }
      return [...prev, id];
    });
  };

  const handleCompare = () => {
    if (selectedEditors.length === 2) {
      navigate({
        to: "/editors/compare",
        search: { ids: selectedEditors.join(",") },
      });
    }
  };

  return (
    <>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Editor Statistics</h1>
            <p className="text-slate-600 mt-1">
              {isLoading
                ? "Loading editors..."
                : error
                  ? "Failed to load editors"
                  : `${editors.length} OKA program editors — lifetime activity since enrollment`}
            </p>
          </div>
          {selectedEditors.length === 2 && (
            <Button onClick={handleCompare} className="gap-2">
              <GitCompare className="h-4 w-4" />
              Compare Selected
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <SummaryCard title="Active Editors" value={editors.length} icon={Users} />
          <SummaryCard
            title="Words Added"
            value={totalWords.toLocaleString()}
            icon={FileText}
          />
          <SummaryCard
            title="Articles Created"
            value={editors.reduce((s, e) => s + e.articlesCreated, 0).toLocaleString()}
            icon={BookOpen}
          />
          <SummaryCard
            title="Total Uploads"
            value={totalUploads.toLocaleString()}
            icon={HardDrive}
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Compare</TableHead>
                <TableHead>Username</TableHead>
                <TableHead className="text-right w-24">Edits</TableHead>
                <TableHead className="text-right w-28">Words</TableHead>
                <TableHead className="text-right w-28">Created</TableHead>
                <TableHead className="text-right w-28">Edited</TableHead>
                <TableHead className="text-right w-24">Uploads</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-sm text-slate-500">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : editors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-sm text-slate-500">
                    No editors found.
                  </TableCell>
                </TableRow>
              ) : (
                editors.map((editor) => (
                  <TableRow key={editor.editorId}>
                    <TableCell>
                      <Checkbox
                        checked={selectedEditors.includes(editor.editorId)}
                        onCheckedChange={() => toggleEditorSelection(editor.editorId)}
                        aria-label={`Select ${editor.username} for comparison`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                          {editor.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => navigate({ to: `/editors/${editor.editorId}` })}
                              className="hover:underline text-slate-900 font-medium text-left text-sm"
                            >
                              {editor.username}
                            </button>
                            {editor.hasActivity ? (
                              <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium">
                                Active
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-50 text-slate-400 border border-slate-200 px-2 py-0.5 text-[10px] font-medium">
                                No activity
                              </span>
                            )}
                          </div>
                          <a
                            href={`https://en.wikipedia.org/wiki/User:${editor.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View on Wikipedia"
                            className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-xs"
                          >
                            Wiki profile <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-slate-700">
                      {editor.edits.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-slate-700">
                      {editor.wordsAdded.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-slate-700">
                      {editor.articlesCreated.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-slate-700">
                      {editor.articlesEdited.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-slate-700">
                      {editor.commonsUploads.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
