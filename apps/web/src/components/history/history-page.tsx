import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Calendar, Filter, LineChart, Users, FileText, BookOpen, Eye, Upload } from "lucide-react";
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
import {
  fetchArticleHistory,
  fetchEditorHistory,
  fetchStatsHistory,
  fetchArticleStats,
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

const formatDelta = (value?: number) => {
  if (value === undefined) return "-";
  if (value === 0) return "0";
  return value > 0 ? `+${value.toLocaleString()}` : value.toLocaleString();
};

export function HistoryPage() {
  const defaultRange = useMemo(() => getDefaultDateRange(), []);
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [wikiProject, setWikiProject] = useState<string>("all");
  const [source, setSource] = useState<string>("all");
  const [withDelta, setWithDelta] = useState(true);

  const [editorId, setEditorId] = useState("");
  const [editorStart, setEditorStart] = useState(defaultRange.startDate);
  const [editorEnd, setEditorEnd] = useState(defaultRange.endDate);
  const [editorDelta, setEditorDelta] = useState(true);

  const [articleId, setArticleId] = useState("");
  const [articleStart, setArticleStart] = useState(defaultRange.startDate);
  const [articleEnd, setArticleEnd] = useState(defaultRange.endDate);
  const [articleDelta, setArticleDelta] = useState(true);

  const { data: wikiStats } = useQuery({
    queryKey: ["stats", "articles", "wiki"],
    queryFn: fetchArticleStats,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["stats", "history", startDate, endDate, wikiProject, source, withDelta],
    queryFn: () =>
      fetchStatsHistory({
        startDate: startDate ? toIsoDate(startDate) : undefined,
        endDate: endDate ? toIsoDate(endDate) : undefined,
        wikiProject: wikiProject !== "all" ? wikiProject : undefined,
        source: source !== "all" ? (source as "MEDIAWIKI" | "OUTREACH_DASHBOARD") : undefined,
        withDelta,
      }),
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

  const series = historyData?.series ?? [];
  const latest = series[series.length - 1];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">History & Reports</h1>
        <p className="text-slate-600 mt-1">
          Daily snapshots for global, editor, and article performance.
        </p>
      </div>

      <AnnualReportSection />

      <MonthlyReportSection />

      <Card className="mb-8">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Global Daily History</CardTitle>
            <p className="text-sm text-muted-foreground">
              Filter by date, wiki, or source to build reports.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {startDate} to {endDate}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Wiki Project</Label>
              <select
                value={wikiProject}
                onChange={(e) => setWikiProject(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All Wikis</option>
                {(wikiStats?.wikiStats ?? []).map((stat) => (
                  <option key={stat.wiki} value={stat.wiki}>
                    {stat.wiki}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All Sources</option>
                <option value="OUTREACH_DASHBOARD">Outreach Dashboard</option>
                <option value="MEDIAWIKI">MediaWiki</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-6 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={withDelta}
                onChange={(e) => setWithDelta(e.target.checked)}
              />
              Show daily delta
            </label>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Articles Created</CardTitle>
                <FileText className="h-4 w-4 text-slate-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(latest?.articlesCreated)}</div>
                {withDelta && (
                  <p className="text-xs text-muted-foreground">
                    delta {formatDelta(latest?.delta?.articlesCreated)}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Articles Edited</CardTitle>
                <LineChart className="h-4 w-4 text-slate-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(latest?.articlesEdited)}</div>
                {withDelta && (
                  <p className="text-xs text-muted-foreground">
                    delta {formatDelta(latest?.delta?.articlesEdited)}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Editors Active</CardTitle>
                <Users className="h-4 w-4 text-slate-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(latest?.editors)}</div>
                {withDelta && (
                  <p className="text-xs text-muted-foreground">
                    delta {formatDelta(latest?.delta?.editors)}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Edits</CardTitle>
                <LineChart className="h-4 w-4 text-slate-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(latest?.edits)}</div>
                {withDelta && (
                  <p className="text-xs text-muted-foreground">
                    delta {formatDelta(latest?.delta?.edits)}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Words Added</CardTitle>
                <LineChart className="h-4 w-4 text-slate-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(latest?.wordsAdded)}</div>
                {withDelta && (
                  <p className="text-xs text-muted-foreground">
                    delta {formatDelta(latest?.delta?.wordsAdded)}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">References Added</CardTitle>
                <BookOpen className="h-4 w-4 text-slate-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(latest?.referencesAdded)}</div>
                {withDelta && (
                  <p className="text-xs text-muted-foreground">
                    delta {formatDelta(latest?.delta?.referencesAdded)}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Article Views</CardTitle>
                <Eye className="h-4 w-4 text-slate-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(latest?.pageviews)}</div>
                {withDelta && (
                  <p className="text-xs text-muted-foreground">
                    delta {formatDelta(latest?.delta?.pageviews)}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Commons Uploads</CardTitle>
                <Upload className="h-4 w-4 text-slate-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(latest?.commonsUploads)}</div>
                {withDelta && (
                  <p className="text-xs text-muted-foreground">
                    delta {formatDelta(latest?.delta?.commonsUploads)}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Edits</TableHead>
                  <TableHead className="text-right">Words</TableHead>
                  <TableHead className="text-right">Articles Created</TableHead>
                  <TableHead className="text-right">Articles Edited</TableHead>
                  <TableHead className="text-right">Editors</TableHead>
                  <TableHead className="text-right">Refs</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Uploads</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Loading history...
                    </TableCell>
                  </TableRow>
                ) : series.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                      No history data available for this range.
                    </TableCell>
                  </TableRow>
                ) : (
                  series.map((row) => (
                    <TableRow key={row.date}>
                      <TableCell className="font-medium">{row.date.slice(0, 10)}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.edits)}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.wordsAdded)}</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.articlesCreated)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.articlesEdited)}
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(row.editors)}</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.referencesAdded)}
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(row.pageviews)}</TableCell>
                      <TableCell className="text-right">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Editor History</CardTitle>
            <p className="text-sm text-muted-foreground">Track daily performance per editor.</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label>Editor ID</Label>
                <Input
                  value={editorId}
                  onChange={(e) => setEditorId(e.target.value)}
                  placeholder="Paste editor ID"
                />
                <p className="text-xs text-muted-foreground">
                  Copy from{" "}
                  <Link to="/editors" className="underline">
                    Editors list
                  </Link>
                </p>
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={editorStart}
                  onChange={(e) => setEditorStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={editorEnd}
                  onChange={(e) => setEditorEnd(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={editorDelta}
                    onChange={(e) => setEditorDelta(e.target.checked)}
                  />
                  Show delta
                </label>
              </div>
            </div>

            {!editorId ? (
              <div className="text-sm text-muted-foreground">
                Enter an editor ID to view history.
              </div>
            ) : editorLoading ? (
              <div className="text-sm text-muted-foreground">Loading editor history...</div>
            ) : (editorHistory?.series?.length ?? 0) === 0 ? (
              <div className="text-sm text-muted-foreground">No history data for this editor.</div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Edits</TableHead>
                      <TableHead className="text-right">Words</TableHead>
                      <TableHead className="text-right">Articles</TableHead>
                      <TableHead className="text-right">Uploads</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(editorHistory?.series ?? []).map((row) => (
                      <TableRow key={row.date}>
                        <TableCell className="font-medium">{row.date.slice(0, 10)}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(row.edits)}
                          {editorDelta && (
                            <span className="block text-xs text-muted-foreground">
                              delta {formatDelta(row.delta?.edits)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(row.wordsAdded)}
                          {editorDelta && (
                            <span className="block text-xs text-muted-foreground">
                              delta {formatDelta(row.delta?.wordsAdded)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(row.articlesCreated)}
                          {editorDelta && (
                            <span className="block text-xs text-muted-foreground">
                              delta {formatDelta(row.delta?.articlesCreated)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
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
          <CardHeader>
            <CardTitle className="text-lg">Article History</CardTitle>
            <p className="text-sm text-muted-foreground">Daily pageviews and metadata snapshot.</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label>Article ID</Label>
                <Input
                  value={articleId}
                  onChange={(e) => setArticleId(e.target.value)}
                  placeholder="Paste article ID"
                />
                <p className="text-xs text-muted-foreground">
                  Copy from{" "}
                  <Link to="/articles" className="underline">
                    Articles list
                  </Link>
                </p>
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={articleStart}
                  onChange={(e) => setArticleStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={articleEnd}
                  onChange={(e) => setArticleEnd(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={articleDelta}
                    onChange={(e) => setArticleDelta(e.target.checked)}
                  />
                  Show delta
                </label>
              </div>
            </div>

            {!articleId ? (
              <div className="text-sm text-muted-foreground">
                Enter an article ID to view history.
              </div>
            ) : articleLoading ? (
              <div className="text-sm text-muted-foreground">Loading article history...</div>
            ) : (articleHistory?.series?.length ?? 0) === 0 ? (
              <div className="text-sm text-muted-foreground">No history data for this article.</div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Pageviews</TableHead>
                      <TableHead className="text-right">Characters</TableHead>
                      <TableHead className="text-right">References</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(articleHistory?.series ?? []).map((row) => (
                      <TableRow key={row.date}>
                        <TableCell className="font-medium">{row.date.slice(0, 10)}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(row.pageviews)}
                          {articleDelta && (
                            <span className="block text-xs text-muted-foreground">
                              delta {formatDelta(row.delta?.pageviews)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(row.characterSum)}
                          {articleDelta && (
                            <span className="block text-xs text-muted-foreground">
                              delta {formatDelta(row.delta?.characterSum)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Snapshot Utilities</CardTitle>
          <p className="text-sm text-muted-foreground">
            Use this page after running sync to fill historical snapshots.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              const payload = {
                startDate: toIsoDate(startDate),
                endDate: toIsoDate(endDate),
              };
              fetch("/api/stats/history/backfill", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
            }}
          >
            Backfill Current Range
          </Button>
          <span className="text-xs text-muted-foreground">
            This queues a snapshot backfill for the selected date range.
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
