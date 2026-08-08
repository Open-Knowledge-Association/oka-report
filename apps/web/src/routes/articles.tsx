import { createFileRoute, useSearch, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  FilePlus,
  FileEdit,
  Edit,
  Users,
  Type,
  BookOpen,
  Eye,
  Upload,
  Search,
  Globe,
  ExternalLink,
  Info,
} from "lucide-react";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import {
  fetchOutreachArticles,
  fetchArticleStats,
  fetchSnapshotReport,
  ArticleSource,
} from "@/lib/api";

export const Route = createFileRoute("/articles")({
  component: ArticlesPage,
  validateSearch: z.object({
    page: z.number().optional().default(1),
    search: z.string().optional(),
    wiki: z.string().optional(),
  }),
});

const SummaryCard = ({
  title,
  value,
  icon: Icon,
  description,
  help,
}: {
  title: string;
  value: number | string;
  icon: any;
  description?: string;
  help?: string;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <div>
        <div className="flex items-center gap-1.5">
          <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
          {help ? (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 cursor-help text-slate-400" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">{help}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      <Icon className="h-4 w-4 text-slate-400" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
    </CardContent>
  </Card>
);

function ArticlesPage() {
  const search = useSearch({ from: "/articles" });
  const navigate = useNavigate({ from: "/articles" });

  const page = search.page ?? 1;
  const searchTerm = search.search ?? "";
  const wikiFilter = search.wiki ?? "all";

  // Local state for search input (before debounce)
  const [searchInput, setSearchInput] = useState(searchTerm);

  // Debounced search value
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      // Update URL when search changes
      if (searchInput !== searchTerm) {
        navigate({
          search: {
            page: 1,
            search: searchInput || undefined,
            wiki: wikiFilter !== "all" ? wikiFilter : undefined,
          },
        });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, searchTerm, wikiFilter, navigate]);

  // Stats query (global totals)
  const { data: statsData } = useQuery({
    queryKey: ["stats", "articles", "global"],
    queryFn: fetchArticleStats,
  });

  // Articles query (paginated with filters)
  const { data: articlesData, isLoading: articlesLoading } = useQuery({
    queryKey: ["stats", "articles", "list", page, debouncedSearch, wikiFilter],
    queryFn: () =>
      fetchOutreachArticles({
        page,
        limit: 50,
        search: debouncedSearch || undefined,
        wikiProject: wikiFilter !== "all" ? wikiFilter : undefined,
      }),
  });

  // Snapshot stats query (current year totals from pre-aggregated snapshots)
  const year = new Date().getFullYear();
  const { data: snapshotStats, isLoading: statsLoading } = useQuery({
    queryKey: ["snapshot-report", "YEAR", year],
    queryFn: () => fetchSnapshotReport("YEAR", `${year}-01-01`, `${year + 1}-01-01`),
  });
  const dashboardStats = {
    articlesCreated: snapshotStats?.totals.articlesCreated ?? 0,
    articlesEdited: snapshotStats?.totals.articlesEdited ?? 0,
    totalEdits: snapshotStats?.totals.edits ?? 0,
    editorsCount: snapshotStats?.totals.editors ?? 0,
    wordsAdded: snapshotStats?.totals.wordsAdded ?? 0,
    referencesAdded: snapshotStats?.totals.refsAdded ?? 0,
    pageviews: snapshotStats?.totals.viewsTotal ?? 0,
    commonsUploads: snapshotStats?.totals.commonsUploads ?? 0,
  };

  const articles = articlesData?.articles ?? [];
  const pagination = articlesData?.pagination;

  const wikiStats = statsData?.wikiStats ?? [];

  const handlePageChange = (newPage: number) => {
    navigate({
      search: {
        page: newPage,
        search: debouncedSearch || undefined,
        wiki: wikiFilter !== "all" ? wikiFilter : undefined,
      },
    });
  };

  const handleWikiChange = (value: string) => {
    navigate({
      search: {
        page: 1,
        search: debouncedSearch || undefined,
        wiki: value !== "all" ? value : undefined,
      },
    });
  };

  return (
    <>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Article Statistics</h1>
          <p className="text-slate-600 mt-1">Articles by wiki language with pageview metrics</p>
        </div>

        {/* Canonical lifetime metrics shared with the dashboard. */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            title="Articles Created"
            value={statsLoading ? "..." : (dashboardStats?.articlesCreated ?? 0).toLocaleString()}
            icon={FilePlus}
            help="New Wikipedia articles with a tracked first-revision contribution by a program editor this year (parent revision id = 0), from verified contribution data."
          />
          <SummaryCard
            title="Articles Edited"
            value={statsLoading ? "..." : (dashboardStats?.articlesEdited ?? 0).toLocaleString()}
            icon={FileEdit}
            help="Unique articles with tracked contribution activity by program editors this year (created or edited)."
          />
          <SummaryCard
            title="Total Edits"
            value={statsLoading ? "..." : (dashboardStats?.totalEdits ?? 0).toLocaleString()}
            icon={Edit}
            help="Total revisions made by program editors to tracked articles this year, from Wikimedia usercontribs data."
          />
          <SummaryCard
            title="Editors"
            value={statsLoading ? "..." : (dashboardStats?.editorsCount ?? 0).toLocaleString()}
            icon={Users}
            help="Number of program editors with at least one tracked contribution this year, from the Outreach Dashboard enrollment list."
          />
          <SummaryCard
            title="Words Added"
            value={statsLoading ? "..." : (dashboardStats?.wordsAdded ?? 0).toLocaleString()}
            icon={Type}
            help="Sum of net byte changes (sizediff) converted to a word estimate. An estimate, not a linguistic word count."
          />
          <SummaryCard
            title="References Added"
            value={statsLoading ? "..." : (dashboardStats?.referencesAdded ?? 0).toLocaleString()}
            icon={BookOpen}
            help="Total citations (referencesCount) across all articles with program contribution activity this year."
          />
          <SummaryCard
            title="Article Views"
            description="Total impact (created + edited)"
            value={statsLoading ? "..." : (dashboardStats?.pageviews ?? 0).toLocaleString()}
            icon={Eye}
            help="Wikimedia ALL_AGENTS pageviews across all program articles, cutoff-aware from each article's first program contribution."
          />
          <SummaryCard
            title="Commons Uploads"
            value={statsLoading ? "..." : (dashboardStats?.commonsUploads ?? 0).toLocaleString()}
            icon={Upload}
            help="Files uploaded to Wikimedia Commons by program editors after their enrollment date."
          />
        </div>

        {/* Wiki Breakdown Table */}
        {wikiStats.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Pageviews by Wiki</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Wiki Project</TableHead>
                  <TableHead className="text-right">Articles</TableHead>
                  <TableHead className="text-right">Total Pageviews</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wikiStats.map((stat) => (
                  <TableRow key={stat.wiki}>
                    <TableCell className="font-medium">{stat.wiki}</TableCell>
                    <TableCell className="text-right">{stat.count.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{stat.pageviews.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search articles..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={wikiFilter} onValueChange={handleWikiChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by wiki" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Wikis</SelectItem>
              {wikiStats.map((stat) => (
                <SelectItem key={stat.wiki} value={stat.wiki}>
                  {stat.wiki}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Articles Table */}
        <div className="rounded-lg border border-slate-200 bg-white mb-6">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">
              Articles {wikiFilter !== "all" && `(${wikiFilter})`}
              {pagination && (
                <span className="text-sm font-normal text-slate-500 ml-2">
                  ({pagination.total.toLocaleString()} total)
                </span>
              )}
            </h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Title</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Wiki</TableHead>
                <TableHead className="w-[200px]">Editors</TableHead>
                <TableHead className="text-right">Pageviews</TableHead>
                <TableHead className="text-right">Characters</TableHead>
                <TableHead className="text-right">References</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {articlesLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-sm text-slate-500">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : articles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-sm text-slate-500">
                    {debouncedSearch
                      ? `No articles match "${debouncedSearch}"`
                      : "No articles available."}
                  </TableCell>
                </TableRow>
              ) : (
                articles.map((article) => (
                  <TableRow key={article.id}>
                    <TableCell>
                      <div className="flex items-start gap-2">
                        <div className="min-w-0">
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-900 hover:text-blue-600 font-medium hover:underline flex items-center gap-1"
                          >
                            {article.title}
                            <ExternalLink className="h-3 w-3 text-slate-400" />
                          </a>
                          {article.isNewArticle && (
                            <div className="mt-1">
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 h-5 font-normal bg-blue-50 text-blue-700 hover:bg-blue-100"
                              >
                                Created
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {article.source === ArticleSource.MEDIAWIKI ? (
                        <Badge
                          variant="outline"
                          className="bg-slate-50 text-slate-600 border-slate-200 font-normal"
                        >
                          MediaWiki
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-purple-50 text-purple-700 border-purple-200 font-normal"
                        >
                          Outreach
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-slate-700">
                          {article.wikiProject
                            ? article.wikiProject.replace(".org", "")
                            : `${article.language}.${article.project}`}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {article.editors && article.editors.length > 0 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="cursor-default flex items-center gap-1 flex-wrap">
                                {(() => {
                                  const sorted = [...article.editors].sort(
                                    (a, b) => (b.isAuthor ? 1 : 0) - (a.isAuthor ? 1 : 0),
                                  );
                                  const displayed = sorted.slice(0, 3);
                                  const remaining = sorted.length - 3;

                                  return (
                                    <>
                                      {displayed.map((editor) => (
                                        <Link
                                          key={editor.id}
                                          to="/editors/$editorId"
                                          params={{ editorId: editor.editor.id }}
                                          className={`text-xs px-1.5 py-0.5 rounded border ${
                                            editor.isAuthor
                                              ? "bg-amber-50 text-amber-700 border-amber-200"
                                              : "bg-slate-50 text-slate-600 border-slate-200"
                                          } hover:opacity-80 transition-opacity`}
                                        >
                                          {editor.editor.username}
                                        </Link>
                                      ))}
                                      {remaining > 0 && (
                                        <span className="text-xs text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                                          +{remaining}
                                        </span>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs p-2 bg-white border border-slate-200 shadow-md">
                              <div className="space-y-1.5">
                                <p className="text-xs font-semibold text-slate-900 border-b border-slate-100 pb-1 mb-1">
                                  Contributors
                                </p>
                                {article.editors.slice(0, 8).map((editor) => (
                                  <div key={editor.id} className="flex items-center gap-3">
                                    <div className="flex items-center justify-center h-5 w-5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                                      {editor.editor.username.slice(0, 1).toUpperCase()}
                                    </div>
                                    <span className="text-xs text-slate-700 font-medium">
                                      {editor.editor.username}
                                    </span>
                                    {editor.isAuthor && (
                                      <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                                        Author
                                      </span>
                                    )}
                                  </div>
                                ))}
                                {article.editors.length > 8 && (
                                  <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 flex items-center justify-between">
                                    <span>+{article.editors.length - 8} more</span>
                                    <span className="text-[10px] text-slate-400">
                                      Scroll for more
                                    </span>
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-slate-400 text-xs italic">None recorded</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-slate-700">
                      {(
                        article.pageviews?.[0]?.cumulativeViews ??
                        article.pageviews?.[0]?.views ??
                        0
                      ).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-slate-700">
                      {(article.characterSum || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-slate-700">
                      {(article.referencesCount || 0).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <Pagination
            currentPage={page}
            totalPages={pagination.totalPages}
            onPageChange={handlePageChange}
          />
        )}

        {/* Methodology and scope */}
        <Card>
          <CardHeader>
            <CardTitle>Methodology and scope</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-6 text-slate-600">
            <p>
              This page reports Wikipedia and open-knowledge activity recorded in OKA's local
              statistics database for the current year, attributed to program editors by their
              enrollment date.
            </p>
            <p>
              Summary cards are read from pre-aggregated yearly snapshots (same figures as the
              dashboard and annual report). Article rows show program-window pageviews
              (cutoff-aware from each article's first program contribution); articles without
              program activity show 0. Characters and references reflect each article's tracked
              contribution totals.
            </p>
            <p>
              The Editors column lists program editors with a verified contribution to the
              article; when no contribution is recorded but the article is attributed to an
              editor via Outreach, that attribution is shown as the author. Articles with no
              program attribution show "None recorded".
            </p>
            <p>
              Figures are read from pre-aggregated daily/monthly/yearly snapshots, rebuilt by
              the snapshot_build job; they may change after late upstream data or pageview
              backfills.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
