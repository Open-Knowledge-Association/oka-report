import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { FileText, Eye, Globe } from "lucide-react";
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
import { fetchOutreachArticles, type OutreachArticle } from "@/lib/api";

type WikiStats = {
  wiki: string;
  count: number;
  pageviews: number;
};

export const Route = createFileRoute("/articles")({
  component: ArticlesPage,
});

function ArticlesPage() {
  const [selectedWiki, setSelectedWiki] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["stats", "articles"],
    queryFn: fetchOutreachArticles,
  });

  const articles: OutreachArticle[] = data ?? [];

  // Compute aggregates
  const { totalArticles, totalPageviews, wikiStats, uniqueWikis } = useMemo(() => {
    const totalArticles = articles.length;
    const totalPageviews = articles.reduce((sum, a) => sum + (a.view_count || 0), 0);

    // Group by wiki
    const wikiMap = new Map<string, { count: number; pageviews: number }>();
    articles.forEach((article) => {
      const wiki = `${article.language}.${article.project}`;
      const existing = wikiMap.get(wiki) || { count: 0, pageviews: 0 };
      wikiMap.set(wiki, {
        count: existing.count + 1,
        pageviews: existing.pageviews + (article.view_count || 0),
      });
    });

    const wikiStats: WikiStats[] = Array.from(wikiMap.entries())
      .map(([wiki, stats]) => ({
        wiki,
        count: stats.count,
        pageviews: stats.pageviews,
      }))
      .sort((a, b) => b.pageviews - a.pageviews);

    const uniqueWikis = wikiStats.length;

    return { totalArticles, totalPageviews, wikiStats, uniqueWikis };
  }, [articles]);

  // Filter and sort articles
  const filteredArticles = useMemo(() => {
    let filtered = articles;

    if (selectedWiki !== "all") {
      filtered = articles.filter((a) => `${a.language}.${a.project}` === selectedWiki);
    }

    // Sort by pageviews descending
    return filtered.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
  }, [articles, selectedWiki]);

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
            <div className="text-2xl font-bold">{totalArticles.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pageviews</CardTitle>
            <Eye className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPageviews.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wiki Projects</CardTitle>
            <Globe className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueWikis}</div>
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

      {/* Wiki Filter */}
      <div className="mb-6">
        <Select value={selectedWiki} onValueChange={setSelectedWiki}>
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
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            Articles {selectedWiki !== "all" && `(${selectedWiki})`}
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
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredArticles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                  No articles available.
                </TableCell>
              </TableRow>
            ) : (
              filteredArticles.map((article) => (
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
                    {(article.view_count || 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {(article.character_sum || 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {(article.references_count || 0).toLocaleString()}
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
