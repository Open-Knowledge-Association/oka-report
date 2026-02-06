import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";

interface Article {
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
  pageviews?: Array<{
    type: string;
    views?: number;
    cumulativeViews?: number;
    date: string;
  }>;
}

interface ArticlesTableProps {
  articles: Article[];
}

type SortField = "title" | "characterSum" | "referencesCount" | "pageviews";
type SortOrder = "asc" | "desc";

export function ArticlesTable({ articles }: ArticlesTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [wikiFilter, setWikiFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("characterSum");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const wikis = useMemo(() => {
    const wikiSet = new Set<string>();
    articles.forEach((article) => {
      const wiki = article.wikiProject
        ? article.wikiProject.replace(".org", "")
        : `${article.language}.${article.project}`;
      wikiSet.add(wiki);
    });
    return Array.from(wikiSet).sort();
  }, [articles]);

  const filteredAndSortedArticles = useMemo(() => {
    let result = [...articles];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((article) => article.title.toLowerCase().includes(query));
    }

    if (wikiFilter !== "all") {
      result = result.filter((article) => {
        const wiki = article.wikiProject
          ? article.wikiProject.replace(".org", "")
          : `${article.language}.${article.project}`;
        return wiki === wikiFilter;
      });
    }

    result.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortField) {
        case "title":
          aValue = a.title;
          bValue = b.title;
          break;
        case "characterSum":
          aValue = a.characterSum;
          bValue = b.characterSum;
          break;
        case "referencesCount":
          aValue = a.referencesCount;
          bValue = b.referencesCount;
          break;
        case "pageviews":
          aValue =
            a.pageviews?.reduce((sum, pv) => sum + (pv.cumulativeViews ?? pv.views ?? 0), 0) ?? 0;
          bValue =
            b.pageviews?.reduce((sum, pv) => sum + (pv.cumulativeViews ?? pv.views ?? 0), 0) ?? 0;
          break;
        default:
          aValue = a.characterSum;
          bValue = b.characterSum;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortOrder === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      return sortOrder === "asc"
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

    return result;
  }, [articles, searchQuery, wikiFilter, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredAndSortedArticles.length / itemsPerPage);
  const paginatedArticles = filteredAndSortedArticles.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  if (articles.length === 0) {
    return (
      <div
        data-testid="articles-table-empty"
        className="py-8 text-center bg-slate-50 rounded border border-slate-200"
      >
        <p className="text-slate-500">No articles found</p>
      </div>
    );
  }

  return (
    <div data-testid="articles-table" className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          data-testid="article-search"
          placeholder="Search articles..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="max-w-sm"
        />
        <Select
          value={wikiFilter}
          onValueChange={(value) => {
            setWikiFilter(value);
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by wiki" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Wikis</SelectItem>
            {wikis.map((wiki) => (
              <SelectItem key={wiki} value={wiki}>
                {wiki}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  onClick={() => handleSort("title")}
                  className="flex items-center gap-1 hover:text-blue-600"
                >
                  Title
                  {sortField === "title" && <ArrowUpDown className="w-4 h-4" />}
                </button>
              </TableHead>
              <TableHead>Wiki</TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("characterSum")}
                  className="flex items-center gap-1 hover:text-blue-600"
                >
                  Characters
                  {sortField === "characterSum" && <ArrowUpDown className="w-4 h-4" />}
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("referencesCount")}
                  className="flex items-center gap-1 hover:text-blue-600"
                >
                  References
                  {sortField === "referencesCount" && <ArrowUpDown className="w-4 h-4" />}
                </button>
              </TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedArticles.map((article) => (
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
                <TableCell>{article.characterSum.toLocaleString()}</TableCell>
                <TableCell>{article.referencesCount.toLocaleString()}</TableCell>
                <TableCell>
                  {article.rating && <Badge variant="secondary">{article.rating}</Badge>}
                </TableCell>
                <TableCell>
                  {article.isNewArticle && <Badge variant="default">Created</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, filteredAndSortedArticles.length)} of{" "}
            {filteredAndSortedArticles.length} articles
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="flex items-center px-3 text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
