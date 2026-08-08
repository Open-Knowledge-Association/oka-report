import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Calendar, Filter, LineChart, Users, FileText, Eye, Upload, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  fetchEditorHistory,
  fetchSnapshotDaily,
  fetchArticleHistory,
  PROGRAM_START_DATE,
} from "@/lib/api";
import { AnnualReportSection } from "./annual-report-section";
import { MonthlyReportSection } from "./monthly-report-section";

const toIsoDate = (value: string) => `${value}T00:00:00.000Z`;

const getDefaultDateRange = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  const toInput = (date: Date) => date.toISOString().slice(0, 10);
  return {
    startDate: toInput(start),
    endDate: toInput(end),
  };
};

const formatNumber = (value: number | null | undefined) => (value ?? 0).toLocaleString();

const dailyMetricHelp: Record<string, string> = {
  "Articles Created": "Sum of daily snapshot article-creation counts across the selected date range.",
  "Articles Edited": "Sum of daily unique edited-article counts. An article can appear on multiple days in a range.",
  "Editors Active": "Sum of daily active-editor counts; this is operational daily activity, not a deduplicated range total.",
  "Total Edits": "Contribution edits recorded in daily snapshots for the selected date range.",
  "Words Added": "Estimated words added from daily snapshot rollups.",
  "Article Views": "Daily snapshot reporting views for program activity, not lifetime cumulative pageviews.",
  "Commons Uploads": "Commons uploads recorded in daily snapshots for the selected range.",
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

const formatDelta = (value?: number) => {
  if (value === undefined) return "-";
  if (value === 0) return "0";
  return value > 0 ? `+${value.toLocaleString()}` : value.toLocaleString();
};

export function HistoryPage() {
  const defaultRange = useMemo(() => getDefaultDateRange(), []);
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [editorId, setEditorId] = useState("");
  const [editorStart, setEditorStart] = useState(defaultRange.startDate);
  const [editorEnd, setEditorEnd] = useState(defaultRange.endDate);
  const [editorDelta, setEditorDelta] = useState(true);

  const [articleId, setArticleId] = useState("");
  const [articleStart, setArticleStart] = useState(defaultRange.startDate);
  const [articleEnd, setArticleEnd] = useState(defaultRange.endDate);
  const [articleDelta, setArticleDelta] = useState(true);
  const [snapshotStatus, setSnapshotStatus] = useState<string>("");

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["snapshot", "daily", startDate, endDate],
    queryFn: () =>
      fetchSnapshotDaily(
        startDate ? toIsoDate(startDate) : `${PROGRAM_START_DATE}T00:00:00.000Z`,
        endDate ? toIsoDate(endDate) : new Date().toISOString(),
      ),
  });

  const { data: editorHistory, isLoading: editorLoading } = useQuery({
    queryKey: ["stats", "history", "editor", editorId, editorStart, editorEnd, editorDelta],
    queryFn: () =>
      fetchEditorHistory({
        editorId,
        startDate: editorStart ? toIsoDate(editorStart) : undefined,
        endDate: editorEnd ? toIsoDate(editorEnd) : undefined,
        withDelta: editorDelta,
      }),
    enabled: editorId.length > 0,
  });

  const { data: articleHistory, isLoading: articleLoading } = useQuery({
    queryKey: ["stats", "history", "article", articleId, articleStart, articleEnd, articleDelta],
    queryFn: () =>
      fetchArticleHistory({
        articleId,
        startDate: articleStart ? toIsoDate(articleStart) : undefined,
        endDate: articleEnd ? toIsoDate(articleEnd) : undefined,
        withDelta: articleDelta,
      }),
    enabled: articleId.length > 0,
  });

  const series = historyData ?? [];
  const summary = useMemo(() => {
    if (!series.length) return undefined;
    const acc = {
      articlesCreated: 0,
      articlesEdited: 0,
      editors: 0,
      edits: 0,
      wordsAdded: 0,
      referencesAdded: 0,
      pageviews: 0,
      commonsUploads: 0,
    };
    for (const p of series) {
      acc.articlesCreated += p.articlesCreated;
      acc.articlesEdited += p.articlesEdited;
      acc.editors += p.editors;
      acc.edits += p.edits;
      acc.wordsAdded += p.wordsAdded;
      acc.referencesAdded += p.refsAdded;
      acc.pageviews += p.viewsTotal;
      acc.commonsUploads += p.commonsUploads;
    }
    return acc;
  }, [series]);

  const handleBackfillSnapshots = async () => {
    try {
      setSnapshotStatus("Submitting snapshot build job...");
      const response = await fetch("/api/sync/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType: "snapshot_build" }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        setSnapshotStatus("Failed to queue snapshot backfill.");
        return;
      }

      setSnapshotStatus(`Snapshot backfill queued (job: ${result.data?.jobId ?? "unknown"}).`);
    } catch {
      setSnapshotStatus("Failed to queue snapshot backfill.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-slate-900">History & Reports</h1>
          <InfoTip text="Operational history page. Reports use canonical snapshot/report totals; Daily History is for day-to-day monitoring; Entity Lookup drills into one editor or article." />
        </div>
        <p className="text-slate-600 mt-1">
          Monitor daily snapshots, generate period reports, and debug specific editor/article
          trends.
        </p>
      </div>

      <Card className="border-slate-200 bg-slate-50">
        <CardContent className="pt-6 text-sm text-slate-700">
          <div className="grid gap-2 md:grid-cols-2">
            <p>
              <strong>1) Reports:</strong> Annual and monthly summaries for leadership; exports use the same canonical snapshot source as the UI.
            </p>
            <p>
              <strong>2) Daily History:</strong> Day-to-day operational monitoring from pre-aggregated daily snapshots.
            </p>
            <p>
              <strong>3) Entity Lookup:</strong> Drill into one editor or one article, with optional daily delta rows.
            </p>
            <p>
              <strong>4) Snapshot Utilities:</strong> Queue snapshot rebuilds after sync runs; use carefully because it updates report source rows.
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="reports" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto p-1 bg-slate-100 rounded-lg">
          <TabsTrigger
            value="reports"
            className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm py-2"
          >
            Reports
          </TabsTrigger>
          <TabsTrigger
            value="daily"
            className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm py-2"
          >
            Daily History
          </TabsTrigger>
          <TabsTrigger
            value="entity"
            className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm py-2"
          >
            Entity Lookup
          </TabsTrigger>
          <TabsTrigger
            value="utilities"
            className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm py-2"
          >
            Snapshot Utilities
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-8">
          <AnnualReportSection />
          <MonthlyReportSection />
        </TabsContent>

        <TabsContent value="daily" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 bg-slate-50/50 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg font-semibold text-slate-900">Global Daily History</CardTitle>
                  <InfoTip text="Daily snapshots are operational rows. References Added is intentionally not shown here until daily refs are populated reliably." />
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  Daily snapshot table from pre-aggregated daily metrics.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium bg-white px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 shadow-sm">
                <Calendar className="h-3.5 w-3.5" />
                {startDate} to {endDate}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Start Date
                  </Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    End Date
                  </Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-100 text-sm text-slate-600">
                  <Filter className="h-4 w-4" />
                  <span className="font-medium">View Options:</span>
                </div>
                <span className="text-sm text-slate-600">
                  Summary cards aggregate the selected range; table rows show daily activity.
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  {
                    title: "Articles Created",
                    value: summary?.articlesCreated,
                    icon: FileText,
                  },
                  {
                    title: "Articles Edited",
                    value: summary?.articlesEdited,
                    icon: LineChart,
                  },
                  {
                    title: "Editors Active",
                    value: summary?.editors,
                    icon: Users,
                  },
                  {
                    title: "Total Edits",
                    value: summary?.edits,
                    icon: LineChart,
                  },
                  {
                    title: "Words Added",
                    value: summary?.wordsAdded,
                    icon: LineChart,
                  },
                  {
                    title: "Article Views",
                    value: summary?.pageviews,
                    icon: Eye,
                  },
                  {
                    title: "Commons Uploads",
                    value: summary?.commonsUploads,
                    icon: Upload,
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-lg border border-slate-200 p-4 bg-white shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 uppercase tracking-wider">
                        {item.title}
                        <InfoTip text={dailyMetricHelp[item.title]} />
                      </span>
                      <item.icon className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {formatNumber(item.value)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">selected date range</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[120px] font-semibold text-slate-700">Date</TableHead>
                      <TableHead
                        className="text-right font-semibold text-slate-700"
                        title="Total contribution edits recorded on this day"
                      >
                        Edits
                      </TableHead>
                      <TableHead
                        className="text-right font-semibold text-slate-700"
                        title="Estimated words added from contribution byte deltas"
                      >
                        Words
                      </TableHead>
                      <TableHead
                        className="text-right font-semibold text-slate-700"
                        title="Articles first created on this day"
                      >
                        Articles Created
                      </TableHead>
                      <TableHead
                        className="text-right font-semibold text-slate-700"
                        title="Unique articles edited on this day"
                      >
                        Articles Edited
                      </TableHead>
                      <TableHead
                        className="text-right font-semibold text-slate-700"
                        title="Unique active editors on this day"
                      >
                        Editors
                      </TableHead>
                      <TableHead
                        className="text-right font-semibold text-slate-700"
                        title="Pageviews captured for this day"
                      >
                        Views
                      </TableHead>
                      <TableHead
                        className="text-right font-semibold text-slate-700"
                        title="Commons uploads made on this day"
                      >
                        Uploads
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-sm text-slate-500">
                          Loading history...
                        </TableCell>
                      </TableRow>
                    ) : series.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-sm text-slate-500">
                          No history data available for this range.
                        </TableCell>
                      </TableRow>
                    ) : (
                      series.map((row) => (
                        <TableRow key={row.periodStart} className="hover:bg-slate-50/50">
                          <TableCell className="font-medium text-slate-900">
                            {row.periodStart.slice(0, 10)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-700">
                            {formatNumber(row.edits)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-700">
                            {formatNumber(row.wordsAdded)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-700">
                            {formatNumber(row.articlesCreated)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-700">
                            {formatNumber(row.articlesEdited)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-700">
                            {formatNumber(row.editors)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-700">
                            {formatNumber(row.viewsTotal)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-700">
                            {formatNumber(row.commonsUploads)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entity" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg font-semibold text-slate-900">Editor History</CardTitle>
                  <InfoTip text="Lookup a single editor by ID. Enable daily delta to compare each row with the previous day." />
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  Paste an editor ID to inspect daily edits, words, created articles, and uploads.
                </p>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="space-y-2 col-span-1 md:col-span-2">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Editor ID
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={editorId}
                        onChange={(e) => setEditorId(e.target.value)}
                        placeholder="Paste editor ID"
                        className="bg-white"
                      />
                      <Button variant="outline" asChild>
                        <Link to="/editors">List</Link>
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Start Date
                    </Label>
                    <Input
                      type="date"
                      value={editorStart}
                      onChange={(e) => setEditorStart(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      End Date
                    </Label>
                    <Input
                      type="date"
                      value={editorEnd}
                      onChange={(e) => setEditorEnd(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                  <div className="flex items-end col-span-1 md:col-span-2">
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={editorDelta}
                        onChange={(e) => setEditorDelta(e.target.checked)}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                      />
                      Show daily delta
                    </label>
                  </div>
                </div>

                {!editorId ? (
                  <div className="p-8 text-center text-sm text-slate-500 bg-slate-50 rounded-lg border border-slate-100 border-dashed">
                    Enter an editor ID to view history.
                  </div>
                ) : editorLoading ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    Loading editor history...
                  </div>
                ) : (editorHistory?.series?.length ?? 0) === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    No history data for this editor.
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-white overflow-hidden max-h-[500px] overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-slate-50 sticky top-0">
                        <TableRow>
                          <TableHead className="font-semibold text-slate-700">Date</TableHead>
                          <TableHead className="text-right font-semibold text-slate-700">
                            Edits
                          </TableHead>
                          <TableHead className="text-right font-semibold text-slate-700">
                            Words
                          </TableHead>
                          <TableHead className="text-right font-semibold text-slate-700">
                            Articles
                          </TableHead>
                          <TableHead className="text-right font-semibold text-slate-700">
                            Uploads
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(editorHistory?.series ?? []).map((row) => (
                          <TableRow key={row.date} className="hover:bg-slate-50/50">
                            <TableCell className="font-medium text-slate-900">
                              {row.date.slice(0, 10)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-700">
                              {formatNumber(row.edits)}
                              {editorDelta && (
                                <span className="block text-xs text-muted-foreground">
                                  delta {formatDelta(row.delta?.edits)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-700">
                              {formatNumber(row.wordsAdded)}
                              {editorDelta && (
                                <span className="block text-xs text-muted-foreground">
                                  delta {formatDelta(row.delta?.wordsAdded)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-700">
                              {formatNumber(row.articlesCreated)}
                              {editorDelta && (
                                <span className="block text-xs text-muted-foreground">
                                  delta {formatDelta(row.delta?.articlesCreated)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-700">
                              {formatNumber(row.commonsUploads)}
                              {editorDelta && (
                                <span className="block text-xs text-muted-foreground">
                                  delta {formatDelta(row.delta?.commonsUploads)}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg font-semibold text-slate-900">Article History</CardTitle>
                  <InfoTip text="Lookup one article by ID to inspect pageviews, character count, references, and daily deltas." />
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  Paste an article ID to inspect day-by-day pageviews and content metrics.
                </p>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="space-y-2 col-span-1 md:col-span-2">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Article ID
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={articleId}
                        onChange={(e) => setArticleId(e.target.value)}
                        placeholder="Paste article ID"
                        className="bg-white"
                      />
                      <Button variant="outline" asChild>
                        <Link to="/articles">List</Link>
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Start Date
                    </Label>
                    <Input
                      type="date"
                      value={articleStart}
                      onChange={(e) => setArticleStart(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      End Date
                    </Label>
                    <Input
                      type="date"
                      value={articleEnd}
                      onChange={(e) => setArticleEnd(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                  <div className="flex items-end col-span-1 md:col-span-2">
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={articleDelta}
                        onChange={(e) => setArticleDelta(e.target.checked)}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                      />
                      Show daily delta
                    </label>
                  </div>
                </div>

                {!articleId ? (
                  <div className="p-8 text-center text-sm text-slate-500 bg-slate-50 rounded-lg border border-slate-100 border-dashed">
                    Enter an article ID to view history.
                  </div>
                ) : articleLoading ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    Loading article history...
                  </div>
                ) : (articleHistory?.series?.length ?? 0) === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    No history data for this article.
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-white overflow-hidden max-h-[500px] overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-slate-50 sticky top-0">
                        <TableRow>
                          <TableHead className="font-semibold text-slate-700">Date</TableHead>
                          <TableHead className="text-right font-semibold text-slate-700">
                            Pageviews
                          </TableHead>
                          <TableHead className="text-right font-semibold text-slate-700">
                            Characters
                          </TableHead>
                          <TableHead className="text-right font-semibold text-slate-700">
                            References
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(articleHistory?.series ?? []).map((row) => (
                          <TableRow key={row.date} className="hover:bg-slate-50/50">
                            <TableCell className="font-medium text-slate-900">
                              {row.date.slice(0, 10)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-700">
                              {formatNumber(row.pageviews)}
                              {articleDelta && (
                                <span className="block text-xs text-muted-foreground">
                                  delta {formatDelta(row.delta?.pageviews)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-700">
                              {formatNumber(row.characterSum)}
                              {articleDelta && (
                                <span className="block text-xs text-muted-foreground">
                                  delta {formatDelta(row.delta?.characterSum)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-700">
                              {formatNumber(row.referencesCount)}
                              {articleDelta && (
                                <span className="block text-xs text-muted-foreground">
                                  delta {formatDelta(row.delta?.referencesCount)}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="utilities" className="space-y-6">
          <Card>
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg font-semibold text-slate-900">Snapshot Utilities</CardTitle>
                <InfoTip text="Queues snapshot_build jobs for the selected range. Re-running a day updates the existing snapshot rows rather than creating duplicate day rows." />
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Use after sync runs to fill missing historical days for the selected date range.
              </p>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Backfill Start Date
                  </Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Backfill End Date
                  </Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-white"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4 text-sm text-blue-900">
                <p className="font-semibold mb-2">How to use</p>
                <ol className="list-decimal pl-4 space-y-1 text-blue-800">
                  <li>Set the start and end date above.</li>
                  <li>
                    Click <strong>Backfill Current Range</strong> below.
                  </li>
                  <li>Monitor progress in Sync Job Manager.</li>
                </ol>
                <p className="mt-2 text-xs text-blue-700">
                  Re-running the same date updates snapshots for that day (no duplicate day rows).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button variant="default" onClick={handleBackfillSnapshots}>
                  Backfill Current Range
                </Button>
                <Button asChild variant="outline">
                  <Link to="/admin/sync-jobs">Open Sync Job Manager</Link>
                </Button>
              </div>

              {snapshotStatus ? (
                <div className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
                  {snapshotStatus}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
