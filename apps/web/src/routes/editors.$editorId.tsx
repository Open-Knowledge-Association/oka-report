import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ExternalLink,
  Users,
  FileText,
  BookOpen,
  Eye,
  BarChart,
  GitCompare,
  Medal,
  Calendar,
  Link as LinkIcon,
  Image as ImageIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArticleSource } from "@/lib/api";
import { EditorStatsCards } from "@/components/editor/EditorStatsCards";
import { AchievementBadges } from "@/components/editor/AchievementBadges";
import { ChartsSection } from "@/components/editor/ChartsSection";
import { ArticlesTable } from "@/components/editor/ArticlesTable";
import { CommonsGallery } from "@/components/editor/CommonsGallery";
import { ExportButton } from "@/components/editor/ExportButton";
import { ShareButton } from "@/components/editor/ShareButton";

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
    isNewArticle?: boolean;
    rating?: string | null;
    source?: ArticleSource;
    pageviews?: Array<{
      type: string;
      views?: number;
      cumulativeViews?: number;
      date: string;
    }>;
  }>;
}

interface DailyStat {
  date: string;
  edits: number;
  wordsAdded: number;
  articlesCreated: number;
  articlesEdited: number;
  referencesAdded: number;
  commonsUploads: number;
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

  const { data: dailyStats } = useQuery<DailyStat[]>({
    queryKey: ["editor", "daily-stats", editorId],
    queryFn: async () => {
      const response = await fetch(`/api/editors/${editorId}/daily-stats`);
      if (!response.ok) throw new Error("Failed to fetch daily stats");
      const result = await response.json();
      return result.data;
    },
  });

  if (isLoading) {
    return (
      <>
        <div className="mx-auto w-full max-w-6xl space-y-8">
          <div className="h-10 w-64 bg-slate-200 animate-pulse rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-slate-200 animate-pulse rounded" />
            ))}
          </div>
          <div className="h-96 bg-slate-200 animate-pulse rounded" />
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
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
      </>
    );
  }

  const { editor, outreachStats, wikimediaProfile, articles } = data;

  return (
    <>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-slate-900">{editor.username}</h1>
              <Badge variant="outline" className="text-slate-500 font-normal gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                {editor.wiki}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <a
                href={`https://${editor.wiki}.org/wiki/User:${encodeURIComponent(editor.username)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-blue-600 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Wikipedia Profile
              </a>
              {wikimediaProfile?.registration && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  Joined {new Date(wikimediaProfile.registration).getFullYear()}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild className="gap-2">
              <Link to="/editors/compare" search={{ ids: editorId }}>
                <GitCompare className="h-4 w-4" />
                Compare
              </Link>
            </Button>
            <ExportButton profile={data} />
            <ShareButton editorId={editorId} username={editor.username} />
          </div>
        </div>

        <section>
          <EditorStatsCards stats={outreachStats} />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <section>
              <div className="flex items-center gap-2 mb-4">
                <BarChart className="h-5 w-5 text-slate-500" />
                <h2 className="text-lg font-semibold text-slate-900">Contribution Analytics</h2>
              </div>
              <ChartsSection editorId={editorId} articles={articles} dailyStats={dailyStats} />
            </section>

            <section>
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-slate-500" />
                <h2 className="text-lg font-semibold text-slate-900">Created Articles</h2>
              </div>
              <ArticlesTable articles={articles} />
            </section>
          </div>

          <div className="space-y-6">
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Medal className="h-5 w-5 text-slate-500" />
                <h2 className="text-lg font-semibold text-slate-900">Achievements</h2>
              </div>
              <AchievementBadges editorId={editorId} />
            </section>

            <section>
              <div className="flex items-center gap-2 mb-4">
                <ImageIcon className="h-5 w-5 text-slate-500" />
                <h2 className="text-lg font-semibold text-slate-900">Commons Uploads</h2>
              </div>
              <CommonsGallery editorId={editorId} />
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
