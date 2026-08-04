import {
  LineChart,
  Users,
  Eye,
  Type,
  Filter,
  RefreshCw,
  Download,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadMonthlyReport, fetchMonthlyStats, fetchTopArticles } from "@/lib/api";

type PerformanceMetric = "pageviews" | "edits" | "wordsAdded";
const formatMetric = (value: number | null | undefined) => value == null ? "Unavailable" : value.toLocaleString();

const months = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export function MonthlyReportSection() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [wikiProject, setWikiProject] = useState("");
  const [format, setFormat] = useState<"pdf" | "csv" | "json">("pdf");
  const [isLoading, setIsLoading] = useState(false);
  const [performanceMetric, setPerformanceMetric] = useState<PerformanceMetric>("pageviews");
  const [wikiSortMetric, setWikiSortMetric] = useState<PerformanceMetric>("pageviews");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedYear = window.localStorage.getItem("history.monthly.year");
    const storedMonth = window.localStorage.getItem("history.monthly.month");
    const storedWikiProject = window.localStorage.getItem("history.monthly.wikiProject");
    const storedFormat = window.localStorage.getItem("history.monthly.format") as
      | "pdf"
      | "csv"
      | "json"
      | null;
    const storedPerformanceMetric = window.localStorage.getItem(
      "history.monthly.performanceMetric",
    ) as PerformanceMetric | null;
    const storedWikiSortMetric = window.localStorage.getItem(
      "history.monthly.wikiSortMetric",
    ) as PerformanceMetric | null;

    if (storedYear && Number.isFinite(Number(storedYear))) {
      setYear(Number(storedYear));
    }

    if (storedMonth && Number.isFinite(Number(storedMonth))) {
      const parsedMonth = Number(storedMonth);
      if (parsedMonth >= 1 && parsedMonth <= 12) {
        setMonth(parsedMonth);
      }
    }

    if (storedWikiProject !== null) {
      setWikiProject(storedWikiProject);
    }

    if (storedFormat && ["pdf", "csv", "json"].includes(storedFormat)) {
      setFormat(storedFormat);
    }

    if (
      storedPerformanceMetric &&
      ["pageviews", "edits", "wordsAdded"].includes(storedPerformanceMetric)
    ) {
      setPerformanceMetric(storedPerformanceMetric);
    }

    if (
      storedWikiSortMetric &&
      ["pageviews", "edits", "wordsAdded"].includes(storedWikiSortMetric)
    ) {
      setWikiSortMetric(storedWikiSortMetric);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("history.monthly.year", String(year));
  }, [year]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("history.monthly.month", String(month));
  }, [month]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("history.monthly.wikiProject", wikiProject);
  }, [wikiProject]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("history.monthly.format", format);
  }, [format]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("history.monthly.performanceMetric", performanceMetric);
  }, [performanceMetric]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("history.monthly.wikiSortMetric", wikiSortMetric);
  }, [wikiSortMetric]);

  const { data: monthlyStats, isLoading: isStatsLoading } = useQuery({
    queryKey: ["stats", "monthly", year, month, wikiProject],
    queryFn: () =>
      fetchMonthlyStats({
        year,
        month,
        wikiProject: wikiProject || undefined,
        includeMoM: true,
      }),
  });

  const { data: topArticles, isLoading: isTopLoading } = useQuery({
    queryKey: ["stats", "top-articles", year, month, wikiProject],
    queryFn: () =>
      fetchTopArticles({ year, month, wikiProject: wikiProject || undefined, limit: 10 }),
  });


  const maxDailyValue = Math.max(
    1,
    ...(monthlyStats?.dailyPerformance?.map((point) => point[performanceMetric]) ?? [1]),
  );

  const formatPercent = (value: number | undefined) => (value ?? 0).toFixed(2);

  const wikiRows = [...(monthlyStats?.byWikiProject ?? [])].sort(
    (a, b) => b[wikiSortMetric] - a[wikiSortMetric],
  );

  const handleExport = async () => {
    setIsLoading(true);
    try {
      const blob = await downloadMonthlyReport({ year, month, format, wikiProject });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `oka-monthly-report-${year}-${month.toString().padStart(2, "0")}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const yearOptions = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);

  const resetPreferences = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setWikiProject("");
    setFormat("pdf");
    setPerformanceMetric("pageviews");
    setWikiSortMetric("pageviews");

    if (typeof window !== "undefined") {
      window.localStorage.removeItem("history.monthly.year");
      window.localStorage.removeItem("history.monthly.month");
      window.localStorage.removeItem("history.monthly.wikiProject");
      window.localStorage.removeItem("history.monthly.format");
      window.localStorage.removeItem("history.monthly.performanceMetric");
      window.localStorage.removeItem("history.monthly.wikiSortMetric");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 bg-slate-50/50 pb-4">
        <div>
          <CardTitle className="text-lg font-semibold text-slate-900">Monthly Report</CardTitle>
          <p className="text-sm text-slate-500 mt-1">
            Month-over-month trends and daily breakdown.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={resetPreferences} className="h-8 gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button onClick={handleExport} disabled={isLoading} size="sm" className="h-8 gap-2">
            {isLoading ? (
              "Generating..."
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Export
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Year
            </Label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:outline-none"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Month
            </Label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:outline-none"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Wiki Project
            </Label>
            <Input
              value={wikiProject}
              onChange={(e) => setWikiProject(e.target.value)}
              placeholder="e.g. id.wikipedia.org"
              className="bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Format
            </Label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as "pdf" | "csv" | "json")}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:outline-none"
            >
              <option value="pdf">PDF Report</option>
              <option value="csv">CSV Data</option>
              <option value="json">JSON Data</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { title: "Edits", value: monthlyStats?.totals.edits, icon: LineChart },
            { title: "Words Added", value: monthlyStats?.totals.wordsAdded, icon: Type },
            { title: "Pageviews", value: monthlyStats?.totals.pageviews, icon: Eye },
            { title: "Editors", value: monthlyStats?.totals.editors, icon: Users },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-lg border border-slate-200 p-4 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {item.title}
                </span>
                <item.icon className="h-4 w-4 text-slate-400" />
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {(item.value ?? 0).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {monthlyStats?.mom ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              {
                label: "MoM Articles Created",
                value: monthlyStats.mom.articlesCreated?.changePercent,
              },
              { label: "MoM Pageviews", value: monthlyStats.mom.pageviews?.changePercent },
              { label: "MoM Words Added", value: monthlyStats.mom.wordsAdded?.changePercent },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-slate-200 p-4 bg-white shadow-sm flex items-center justify-between"
              >
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {item.label}
                </span>
                <span
                  className={`text-lg font-bold ${
                    (item.value ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {(item.value ?? 0) > 0 ? "+" : ""}
                  {formatPercent(item.value)}%
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">
                Daily Performance ({year}-{String(month).padStart(2, "0")})
              </p>
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={performanceMetric}
                  onChange={(e) => setPerformanceMetric(e.target.value as PerformanceMetric)}
                  className="bg-transparent text-xs font-medium text-slate-600 border-none focus:ring-0 p-0 pr-6"
                >
                  <option value="pageviews">Pageviews</option>
                  <option value="edits">Edits</option>
                  <option value="wordsAdded">Words</option>
                </select>
              </div>
            </div>
            {isStatsLoading ? (
              <div className="p-8 text-center text-sm text-slate-500">Loading metrics...</div>
            ) : (monthlyStats?.dailyPerformance?.length ?? 0) === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">No data available.</div>
            ) : (
              <div className="max-h-80 overflow-auto p-2 space-y-1">
                {monthlyStats?.dailyPerformance?.map((point) => (
                  <div
                    key={point.period}
                    className="group flex items-center gap-3 px-2 py-1.5 hover:bg-slate-50 rounded-md"
                  >
                    <span className="text-xs font-mono text-slate-500 w-24">{point.period}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(2, ((point[performanceMetric] ?? 0) / maxDailyValue) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono font-medium text-slate-700 w-20 text-right">
                      {formatMetric(point[performanceMetric])}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-sm font-semibold text-slate-900">
                Top Articles ({year}-{String(month).padStart(2, "0")})
              </p>
            </div>
            {isTopLoading ? (
              <div className="p-8 text-center text-sm text-slate-500">Loading articles...</div>
            ) : (topArticles?.articles.length ?? 0) === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">No top articles found.</div>
            ) : (
              <div className="max-h-80 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-9 text-xs">Rank</TableHead>
                      <TableHead className="h-9 text-xs">Title</TableHead>
                      <TableHead className="h-9 text-xs text-right">Views</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topArticles?.articles.map((article) => (
                      <TableRow key={article.articleId} className="h-10">
                        <TableCell className="py-2 text-xs text-slate-500">
                          #{article.rank}
                        </TableCell>
                        <TableCell
                          className="py-2 font-medium text-sm text-slate-900 truncate max-w-[200px]"
                          title={article.title}
                        >
                          {article.title}
                        </TableCell>
                        <TableCell className="py-2 text-xs font-mono text-right text-slate-700">
                          {formatMetric(article.totalPageviews)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white mt-6">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Wiki Project Breakdown ({year}-{String(month).padStart(2, "0")})
            </h2>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-500">Sort by</Label>
              <select
                value={wikiSortMetric}
                onChange={(e) => setWikiSortMetric(e.target.value as PerformanceMetric)}
                className="bg-slate-50 border-slate-200 rounded text-xs py-1 px-2 focus:ring-slate-400"
              >
                <option value="pageviews">Pageviews</option>
                <option value="edits">Edits</option>
                <option value="wordsAdded">Words</option>
              </select>
            </div>
          </div>
          {(monthlyStats?.byWikiProject.length ?? 0) === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No wiki project data for this period.
            </div>
          ) : (
            <div className="p-0">
              <div className="px-4 py-2 flex items-center gap-4 text-xs text-slate-500 bg-slate-50/50 border-b border-slate-100">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" /> Top Performer
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-400" /> Lowest Performer
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Wiki Project</TableHead>
                    <TableHead className="text-right">Edits</TableHead>
                    <TableHead className="text-right">Words</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Articles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wikiRows.map((row, index) => (
                    <TableRow
                      key={row.wikiProject}
                      className={
                        index === 0
                          ? "bg-emerald-50/60 hover:bg-emerald-100/50"
                          : index === wikiRows.length - 1
                            ? "bg-rose-50/60 hover:bg-rose-100/50"
                            : ""
                      }
                    >
                      <TableCell className="font-medium text-slate-900">
                        {row.wikiProject}
                      </TableCell>
                      <TableCell className="text-right font-mono text-slate-700">
                        {row.edits.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-slate-700">
                        {row.wordsAdded.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-slate-700">
                        {formatMetric(row.pageviews)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-slate-700">
                        {row.articlesCreated.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
