import { LineChart, Users, Eye, Type, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadMonthlyReport, fetchSnapshotReport, type SnapshotReport } from "@/lib/api";

type PerformanceMetric = "pageviews" | "edits" | "wordsAdded";

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

const monthRange = (year: number, month: number) => {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
};

export function MonthlyReportSection() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [format, setFormat] = useState<"pdf" | "csv" | "json">("pdf");
  const [isLoading, setIsLoading] = useState(false);
  const [performanceMetric, setPerformanceMetric] = useState<PerformanceMetric>("pageviews");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedYear = window.localStorage.getItem("history.monthly.year");
    const storedMonth = window.localStorage.getItem("history.monthly.month");
    const storedFormat = window.localStorage.getItem("history.monthly.format") as
      | "pdf"
      | "csv"
      | "json"
      | null;
    const storedPerformanceMetric = window.localStorage.getItem(
      "history.monthly.performanceMetric",
    ) as PerformanceMetric | null;

    if (storedYear && Number.isFinite(Number(storedYear))) setYear(Number(storedYear));
    if (storedMonth && Number.isFinite(Number(storedMonth))) {
      const parsedMonth = Number(storedMonth);
      if (parsedMonth >= 1 && parsedMonth <= 12) setMonth(parsedMonth);
    }
    if (storedFormat && ["pdf", "csv", "json"].includes(storedFormat)) setFormat(storedFormat);
    if (
      storedPerformanceMetric &&
      ["pageviews", "edits", "wordsAdded"].includes(storedPerformanceMetric)
    ) {
      setPerformanceMetric(storedPerformanceMetric);
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
    window.localStorage.setItem("history.monthly.format", format);
  }, [format]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("history.monthly.performanceMetric", performanceMetric);
  }, [performanceMetric]);

  const { start, end } = monthRange(year, month);

  const { data: report, isLoading: isStatsLoading } = useQuery<SnapshotReport>({
    queryKey: ["snapshot-report", "MONTH", year, month],
    queryFn: () => fetchSnapshotReport("MONTH", start, end),
  });

  // Normalize byPeriod -> dailyPerformance shape for the chart
  const dailyPerformance = report?.byPeriod ?? [];
  const totals = report?.totals;
  const topArticles = report?.topArticles ?? [];

  const maxDailyValue = Math.max(
    1,
    ...(dailyPerformance
      .map((p) => (performanceMetric === "edits" ? p.edits : performanceMetric === "wordsAdded" ? p.wordsAdded : p.viewsTotal))
      .filter((v): v is number => typeof v === "number") ?? [1]),
  );

  const handleExport = async () => {
    setIsLoading(true);
    try {
      const blob = await downloadMonthlyReport({ year, month, format });
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

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 rounded-t-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Monthly Report</h3>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={isLoading} className="gap-2">
            <Download className="h-4 w-4" />
            {isLoading ? "Exporting..." : "Export"}
          </Button>
        </div>
      </div>

      <div className="p-5 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Year</Label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:outline-none"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Month</Label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:outline-none"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Format</Label>
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
            { title: "Edits", value: totals?.edits, icon: LineChart },
            { title: "Words Added", value: totals?.wordsAdded, icon: Type },
            { title: "Views (Total)", value: totals?.viewsTotal, icon: Eye },
            { title: "Editors", value: totals?.editors, icon: Users },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border border-slate-200 p-4 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{item.title}</span>
                <item.icon className="h-4 w-4 text-slate-400" />
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {(item.value ?? 0).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">
              Daily Performance ({year}-{String(month).padStart(2, "0")})
            </p>
            <div className="flex items-center gap-2">
              <select
                value={performanceMetric}
                onChange={(e) => setPerformanceMetric(e.target.value as PerformanceMetric)}
                className="bg-transparent text-xs font-medium text-slate-600 border-none focus:ring-0 p-0 pr-6"
              >
                <option value="pageviews">Views</option>
                <option value="edits">Edits</option>
                <option value="wordsAdded">Words</option>
              </select>
            </div>
          </div>
          {isStatsLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading metrics...</div>
          ) : dailyPerformance.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No data available.</div>
          ) : (
            <div className="p-4">
              <div className="flex items-end gap-[2px] h-40">
                {dailyPerformance.map((point) => {
                  const value =
                    performanceMetric === "edits"
                      ? point.edits
                      : performanceMetric === "wordsAdded"
                        ? point.wordsAdded
                        : point.viewsTotal;
                  const height = Math.max(2, ((value ?? 0) / maxDailyValue) * 100);
                  return (
                    <div key={point.periodStart} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-slate-200 hover:bg-slate-400 transition-colors rounded-t"
                        style={{ height: `${height}%` }}
                        title={`${point.periodStart}: ${(value ?? 0).toLocaleString()}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                <span>{dailyPerformance[0]?.periodStart}</span>
                <span>{dailyPerformance[dailyPerformance.length - 1]?.periodStart}</span>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-sm font-semibold text-slate-900">Top Articles</p>
          </div>
          {isStatsLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading...</div>
          ) : topArticles.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No articles found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead className="text-right w-24">Edits</TableHead>
                  <TableHead className="text-right w-24">Views</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topArticles.map((article, i) => (
                  <TableRow key={article.articleId ?? i}>
                    <TableCell className="font-medium">
                      <a
                        href={`https://${article.wikiProject || "en.wikipedia.org"}/wiki/${encodeURIComponent(article.title.replaceAll(" ", "_"))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline text-slate-900 text-sm"
                      >
                        {article.title}
                      </a>
                    </TableCell>
                    <TableCell className="text-right font-mono text-slate-700">
                      {article.edits.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-slate-700">
                      {(article.viewsTotal ?? 0).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
