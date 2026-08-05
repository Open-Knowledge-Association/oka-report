import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchSnapshotReport, fetchSnapshotEditors, type SnapshotTotals, type SnapshotReport } from "@/lib/api";

export const Route = createFileRoute("/annual-reports")({
  component: AnnualReportsPage,
  validateSearch: z.object({
    year: z.number().optional(),
  }),
});

const numberFormat = new Intl.NumberFormat("en-US");
const formatNumber = (value: unknown) =>
  value == null ? "—" : numberFormat.format(typeof value === "number" ? value : 0);
const formatCompact = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

function AnnualReportsPage() {
  const search = useSearch({ from: "/annual-reports" });
  const currentYear = new Date().getFullYear();
  const year = search.year ?? currentYear;

  const annual = useQuery<SnapshotReport>({
    queryKey: ["snapshot-report", "YEAR", year],
    queryFn: () => fetchSnapshotReport("YEAR", `${year}-01-01`, `${year + 1}-01-01`),
  });

  const data = annual.data;
  const totals: SnapshotTotals = data?.totals ?? ({} as SnapshotTotals);

  return (
    <>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge variant="outline">Impact report</Badge>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">OKA Annual Report</h1>
            <p className="mt-1 text-slate-600">
              Wikipedia and open-knowledge impact metrics for {year}.
            </p>
          </div>
          <label className="text-sm text-slate-600">
            Year
            <select
              className="ml-2 rounded-md border border-slate-300 bg-white px-3 py-2"
              value={year}
              onChange={(event) => {
                window.location.href = `/annual-reports?year=${event.target.value}`;
              }}
            >
              {Array.from({ length: 6 }, (_, index) => currentYear - index).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        {annual.isLoading ? <ReportState text="Loading annual metrics..." /> : null}
        {annual.error ? (
          <ReportState
            text={annual.error instanceof Error ? annual.error.message : "Failed to load report"}
            error
          />
        ) : null}

        {data ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric title="Articles created" value={totals.articlesCreated} />
              <Metric title="Articles edited" value={totals.articlesEdited} />
              <Metric title="Views (all articles)" value={totals.viewsTotal} />
              <Metric title="Views (active articles)" value={totals.viewsActive} />
              <Metric title="Active editors" value={totals.editors} />
              <Metric title="Edits" value={totals.edits} />
              <Metric title="Estimated words added" value={totals.wordsAdded} />
              <Metric title="Commons uploads" value={totals.commonsUploads} />
            </section>

            <Card>
              <CardHeader>
                <CardTitle>Monthly breakdown — {year}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {data.byPeriod.length ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-slate-500">
                        <th className="py-2">Month</th>
                        <th>Edits</th>
                        <th>Words</th>
                        <th>Created</th>
                        <th>Edited</th>
                        <th>Editors</th>
                        <th>Views (total)</th>
                        <th>Views (active)</th>
                        <th>Uploads</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byPeriod.map((row) => (
                        <tr className="border-b last:border-0" key={row.periodStart}>
                          <td className="py-2 font-medium">
                            {new Date(row.periodStart).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                          </td>
                          <td>{formatNumber(row.edits)}</td>
                          <td>{formatCompact(row.wordsAdded)}</td>
                          <td>{formatNumber(row.articlesCreated)}</td>
                          <td>{formatNumber(row.articlesEdited)}</td>
                          <td>{formatNumber(row.editors)}</td>
                          <td>{formatCompact(row.viewsTotal)}</td>
                          <td>{formatCompact(row.viewsActive)}</td>
                          <td>{formatNumber(row.commonsUploads)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-slate-500">No monthly data for this year.</p>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Top edited articles</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.topArticles?.length ? (
                    <ol className="space-y-3">
                      {data.topArticles.map((article, i) => (
                        <li
                          className="flex gap-3 border-b pb-2 last:border-0"
                          key={`${i}-${article.articleId}`}
                        >
                          <span className="w-6 text-slate-400">{i + 1}.</span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{article.title}</p>
                            <p className="text-xs text-slate-500">
                              {article.wikiProject} · {formatNumber(article.edits)} edits ·{" "}
                              {formatNumber(article.viewsTotal)} views
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-slate-500">No article activity for this year.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Editor leaderboard</CardTitle>
                </CardHeader>
                <CardContent>
                  <EditorLeaderboard year={year} />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Methodology and scope</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm leading-6 text-slate-600">
                <p>
                  This report measures operational Wikipedia activity recorded in OKA's local
                  statistics database for the selected calendar year, attributed to program
                  editors by their enrollment date.
                </p>
                <p>
                  Articles created means articles with a tracked first-revision contribution in the
                  selected year. Articles edited means unique articles with tracked contribution
                  activity. Views (total) are Wikimedia ALL_AGENTS pageviews across all program
                  articles; Views (active) are pageviews of articles created or edited in the period.
                </p>
                <p>
                  Estimated words added are derived from net byte changes and are an estimate, not a
                  linguistic word count. Financials, donations, grants, partnerships, editathons,
                  and AI research are outside this report.
                </p>
                <p>
                  Figures are read from pre-aggregated daily/monthly/yearly snapshots, rebuilt
                  by the snapshot_build job; they may change after late upstream data or pageview
                  backfills.
                </p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}

function EditorLeaderboard({ year }: { year: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["snapshot-editors", "YEAR", year],
    queryFn: () => fetchSnapshotEditors("YEAR", `${year}-01-01`, `${year + 1}-01-01`),
  });
  if (isLoading) return <p className="text-sm text-slate-500">Loading editors...</p>;
  if (error) return <p className="text-sm text-red-600">Failed to load editors.</p>;
  if (!data?.length) return <p className="text-sm text-slate-500">No editor activity.</p>;
  return (
    <ol className="space-y-3">
      {data.slice(0, 15).map((e, i) => (
        <li className="flex gap-3 border-b pb-2 last:border-0" key={e.editorId}>
          <span className="w-6 text-slate-400">{i + 1}.</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-slate-900">{e.username}</p>
            <p className="text-xs text-slate-500">
              {formatNumber(e.edits)} edits · {formatNumber(e.articlesCreated)} created
            </p>
          </div>
          <span className="text-sm text-slate-600">{formatNumber(e.wordsAdded)} words</span>
        </li>
      ))}
    </ol>
  );
}

function Metric({ title, value }: { title: string; value?: number | null }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-slate-500">{title}</p>
        <p className="mt-2 text-2xl font-bold text-slate-900">{formatNumber(value)}</p>
      </CardContent>
    </Card>
  );
}

function ReportState({ text, error = false }: { text: string; error?: boolean }) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-white text-slate-500"}`}
    >
      {text}
    </div>
  );
}
