import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { FileText, Eye, Globe, Search } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { fetchOutreachArticles, fetchArticleStats } from "@/lib/api";

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
  const { data: statsData, isLoading: statsLoading } = useQuery({
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

  const articles = articlesData?.articles ?? [];
  const pagination = articlesData?.pagination;

  const totalArticles = statsData?.totalArticles ?? 0;
  const totalPageviews = statsData?.totalPageviews ?? 0;
  const uniqueWikis = statsData?.uniqueWikis ?? 0;
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

  const isLoading = statsLoading || articlesLoading;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Article Statistics</h1>
        <p className="text-slate-600 mt-1">Articles by wiki language with pageview metrics</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
            <FileText className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : totalArticles.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pageviews</CardTitle>
            <Eye className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : totalPageviews.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wiki Projects</CardTitle>
            <Globe className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsLoading ? "..." : uniqueWikis}</div>
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
              <TableHead className="text-right">Pageviews</TableHead>
              <TableHead className="text-right">Characters</TableHead>
              <TableHead className="text-right">References</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articlesLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : articles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500">
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
