import { LineChart, Users, Eye, Type, Download, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadAnnualReport, fetchSnapshotReport, type SnapshotReport } from "@/lib/api";

type PerformanceMetric = "pageviews" | "edits" | "wordsAdded";

const yearRange = (year: number) => ({
  start: `${year}-01-01`,
  end: `${year + 1}-01-01`,
});

const metricHelp: Record<string, string> = {
  "Edits": "Canonical yearly total from metric snapshots. Snapshot totals are the source of truth used by the dashboard and exports.",
  "Words Added": "Estimated words added from contribution byte deltas, using the canonical yearly snapshot total.",
  "Views (Total)": "Program reporting pageviews from metric snapshots; not lifetime cumulative article views.",
  "Editors": "Unique active program editors represented in the yearly snapshot.",
};

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-slate-400 cursor-help" aria-label="metric info" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-sm">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function AnnualReportSection() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [format, setFormat] = useState<"pdf" | "csv" | "json">("pdf");
  const [isLoading, setIsLoading] = useState(false);
  const [performanceMetric, setPerformanceMetric] = useState<PerformanceMetric>("pageviews");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedYear = window.localStorage.getItem("history.annual.year");
    const storedFormat = window.localStorage.getItem("history.annual.format") as
      | "pdf"
      | "csv"
      | "json"
      | null;
    const storedPerformanceMetric = window.localStorage.getItem(
      "history.annual.performanceMetric",
    ) as PerformanceMetric | null;

    if (storedYear && Number.isFinite(Number(storedYear))) setYear(Number(storedYear));
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
    window.localStorage.setItem("history.annual.year", String(year));
  }, [year]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("history.annual.format", format);
  }, [format]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("history.annual.performanceMetric", performanceMetric);
  }, [performanceMetric]);

  const { start, end } = yearRange(year);

  const { data: report, isLoading: isStatsLoading } = useQuery<SnapshotReport>({
    queryKey: ["snapshot-report", "YEAR", year],
    queryFn: () => fetchSnapshotReport("YEAR", start, end),
  });

  const monthlyPerformance = report?.byPeriod ?? [];
  const totals = report?.totals;
  const topArticles = report?.topArticles ?? [];

  const maxMonthlyValue = Math.max(
    1,
    ...(monthlyPerformance
      .map((p) => (performanceMetric === "edits" ? p.edits : performanceMetric === "wordsAdded" ? p.wordsAdded : p.viewsTotal))
      .filter((v): v is number => typeof v === "number") ?? [1]),
  );

  const handleExport = async () => {
    setIsLoading(true);
    try {
      const blob = await downloadAnnualReport({ year, format });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `oka-annual-report-${year}.${format}`;
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
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900">Annual Report</h3>
              <InfoTip text="Leadership-oriented yearly report. Totals use canonical metric snapshots, and exports are aligned with the same source." />
            </div>
            <p className="text-xs text-slate-500 mt-1">Canonical annual totals, monthly trend, top articles, and downloadable PDF/CSV/JSON.</p>
          </div>
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
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {item.title}
                  <InfoTip text={metricHelp[item.title]} />
                </span>
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
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">Monthly Performance ({year})</p>
              <InfoTip text="Monthly bars come from snapshot report periods. Switch the metric to compare views, edits, or words across months." />
            </div>
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
          ) : monthlyPerformance.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No data available.</div>
          ) : (
            <div className="p-4">
              <div className="flex items-end gap-[2px] h-40">
                {monthlyPerformance.map((point) => {
                  const value =
                    performanceMetric === "edits"
                      ? point.edits
                      : performanceMetric === "wordsAdded"
                        ? point.wordsAdded
                        : point.viewsTotal;
                  const height = Math.max(2, ((value ?? 0) / maxMonthlyValue) * 100);
                  return (
                    <div key={point.periodStart} className="flex-1 h-full flex flex-col justify-end items-center gap-1">
                      <div
                        className="w-full bg-blue-500/70 hover:bg-blue-600 transition-colors rounded-t shadow-sm"
                        style={{ height: `${height}%` }}
                        title={`${point.periodStart}: ${(value ?? 0).toLocaleString()}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                <span>{monthlyPerformance[0]?.periodStart}</span>
                <span>{monthlyPerformance[monthlyPerformance.length - 1]?.periodStart}</span>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">Top Articles</p>
              <InfoTip text="Top articles are ranked by period article activity views for the selected year." />
            </div>
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
