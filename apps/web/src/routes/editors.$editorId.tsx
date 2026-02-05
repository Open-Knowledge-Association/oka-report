import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, FileText, BookOpen, Eye, Calendar, Hash, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface EditorProfile {
  editor: {
    id: string;
    username: string;
    wiki: string;
  };
  outreachStats: {
    articlesCount: number;
    totalEdits: number;
    charactersAdded: number;
    referencesAdded: number;
    pageviews: number;
  };
  wikimediaProfile: {
    registration: string;
    editcount: number;
    gender: string;
  } | null;
  articles: Array<{
    id: string;
    title: string;
    url: string;
    wikiProject?: string;
    language?: string;
    project?: string;
    characterSum: number;
    referencesCount: number;
  }>;
}

export const Route = createFileRoute("/editors/$editorId")({
  component: EditorProfilePage,
  loader: async ({ params }) => {
    return { editorId: params.editorId };
  },
});

function EditorProfilePage() {
  const { editorId } = Route.useLoaderData();

  const { data, isLoading, error } = useQuery<EditorProfile>({
    queryKey: ["editor", "profile", editorId],
    queryFn: async () => {
      const response = await fetch(`/api/editors/${editorId}/profile`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Editor not found");
        }
        throw new Error("Failed to fetch editor profile");
      }
      const result = await response.json();
      return result.data;
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8">
          <div className="h-10 w-64 mb-2 bg-slate-200 animate-pulse rounded" />
          <div className="h-5 w-48 bg-slate-200 animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-4 w-32 bg-slate-200 animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-20 bg-slate-200 animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="h-64 w-full bg-slate-200 animate-pulse rounded" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <div className="text-center py-16">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {error?.message === "Editor not found" ? "Editor Not Found" : "Error Loading Profile"}
          </h1>
          <p className="text-slate-600">
            {error?.message === "Editor not found"
              ? "The requested editor could not be found."
              : "Failed to load editor profile. Please try again later."}
          </p>
        </div>
      </div>
    );
  }

  const { editor, outreachStats, wikimediaProfile, articles } = data;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-slate-900">{editor.username}</h1>
          <a
            href={`https://${editor.wiki}.org/wiki/User:${encodeURIComponent(editor.username)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-blue-600"
            title="View on Wikipedia"
          >
            <ExternalLink className="h-5 w-5" />
          </a>
        </div>
        <p className="text-slate-600">Editor Profile • {editor.wiki}</p>
      </div>

      {/* Outreach Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Articles</CardTitle>
            <FileText className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{outreachStats.articlesCount.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Characters Added</CardTitle>
            <Users className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {outreachStats.charactersAdded.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">References Added</CardTitle>
            <BookOpen className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {outreachStats.referencesAdded.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pageviews</CardTitle>
            <Eye className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{outreachStats.pageviews.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* MediaWiki Profile */}
      {wikimediaProfile && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Wikipedia Profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Registered</CardTitle>
                <Calendar className="h-4 w-4 text-slate-500" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">
                  {wikimediaProfile.registration
                    ? new Date(wikimediaProfile.registration).toLocaleDateString()
                    : "N/A"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Edits</CardTitle>
                <Hash className="h-4 w-4 text-slate-500" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">
                  {wikimediaProfile.editcount?.toLocaleString() ?? "N/A"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gender</CardTitle>
                <Users className="h-4 w-4 text-slate-500" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold capitalize">
                  {wikimediaProfile.gender ?? "Unknown"}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Articles List */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Articles ({articles.length})</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Wiki</TableHead>
              <TableHead className="text-right">Characters</TableHead>
              <TableHead className="text-right">References</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                  No articles found for this editor.
                </TableCell>
              </TableRow>
            ) : (
              articles.map((article) => (
                <TableRow key={article.id}>
                  <TableCell className="font-medium">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {article.title}
                    </a>
                  </TableCell>
                  <TableCell>
                    {article.wikiProject
                      ? article.wikiProject.replace(".org", "")
                      : `${article.language}.${article.project}`}
                  </TableCell>
                  <TableCell className="text-right">
                    {article.characterSum.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {article.referencesCount.toLocaleString()}
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
