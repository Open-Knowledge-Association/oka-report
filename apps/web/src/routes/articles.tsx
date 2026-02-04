import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { FilePlus, FileEdit, Edit, Users, Type, BookOpen, Eye, Upload, Search } from "lucide-react";
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
import { fetchOutreachArticles, fetchArticleStats, fetchOutreachCourse } from "@/lib/api";

export const Route = createFileRoute("/articles")({
  component: ArticlesPage,
  validateSearch: z.object({
    page: z.number().optional().default(1),
    search: z.string().optional(),
    wiki: z.string().optional(),
  }),
});

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
        wiki: wikiFilter !== "all" ? wikiFilter : undefined,
      }),
  });

  // Course stats query (from Outreach Dashboard)
  const { data: courseData, isLoading: courseLoading } = useQuery({
    queryKey: ["outreach", "course"],
    queryFn: fetchOutreachCourse,
  });

  const course = courseData?.course;

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
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Article Statistics</h1>
        <p className="text-slate-600 mt-1">Articles by wiki language with pageview metrics</p>
      </div>

      {/* Summary Cards - 8 stats from Outreach Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Articles Created</CardTitle>
            <FilePlus className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {courseLoading ? "..." : (course?.created_count ?? "-")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Articles Edited</CardTitle>
            <FileEdit className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {courseLoading ? "..." : (course?.edited_count ?? "-")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Edits</CardTitle>
            <Edit className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {courseLoading ? "..." : (course?.edit_count ?? "-")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Editors</CardTitle>
            <Users className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {courseLoading ? "..." : (course?.student_count ?? "-")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Words Added</CardTitle>
            <Type className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {courseLoading ? "..." : (course?.word_count ?? "-")}
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
              {courseLoading ? "..." : (course?.references_count ?? "-")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Article Views</CardTitle>
            <Eye className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {courseLoading ? "..." : (course?.view_count ?? "-")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commons Uploads</CardTitle>
            <Upload className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {courseLoading ? "..." : (course?.upload_count?.toLocaleString() ?? "-")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Wiki Breakdown Table */}
      {wikiStats.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white mb-8">
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
              <TableHead>Title</TableHead>
              <TableHead>Wiki</TableHead>
              <TableHead>Editors</TableHead>
              <TableHead className="text-right">Pageviews</TableHead>
              <TableHead className="text-right">Characters</TableHead>
              <TableHead className="text-right">References</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articlesLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : articles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                  {debouncedSearch
                    ? `No articles match "${debouncedSearch}"`
                    : "No articles available."}
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
                  <TableCell>{`${article.language}.${article.project}`}</TableCell>
                  <TableCell>
                    {article.editors && article.editors.length > 0 ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="secondary" className="cursor-pointer">
                              {article.editors.length}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="space-y-1">
                              {article.editors.slice(0, 5).map((editor) => (
                                <div key={editor.id} className="flex items-center gap-2">
                                  <Users className="h-3 w-3 text-slate-500" />
                                  <a
                                    href={`/editors/${editor.editor.id}`}
                                    className="text-sm hover:underline"
                                  >
                                    {editor.editor.username}
                                  </a>
                                  {editor.isAuthor && (
                                    <Badge variant="outline" className="text-xs px-1 py-0">
                                      Author
                                    </Badge>
                                  )}
                                </div>
                              ))}
                              {article.editors.length > 5 && (
                                <div className="text-sm text-slate-500">
                                  +{article.editors.length - 5} more
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {(article.pageviews?.[0]?.cumulativeViews || 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {(article.characterSum || 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
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
    </div>
  );
}
