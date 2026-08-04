import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/annual-reports")({
  component: AnnualReportsPage,
  validateSearch: z.object({
    year: z.number().optional(),
  }),
});

const numberFormat = new Intl.NumberFormat("en-US");
const formatNumber = (value: unknown) =>
  value == null ? "—" : numberFormat.format(typeof value === "number" ? value : 0);

type AnnualResponse = {
  year: number;
  totals: Record<string, number | null>;
  byWikiProject: Array<Record<string, string | number>>;
  topArticles: Array<{ rank: number; title: string; wikiProject: string; totalPageviews: number }>;
  methodology: Record<string, string>;
};

function AnnualReportsPage() {
  const search = useSearch({ from: "/annual-reports" });
  const currentYear = new Date().getFullYear();
  const year = search.year ?? currentYear;

  const annual = useQuery<AnnualResponse>({
    queryKey: ["annual-report", year],
    queryFn: async () => {
      const response = await fetch(`/api/stats/annual-impact?year=${year}&limit=10`);
      if (!response.ok) throw new Error(`Annual report request failed (${response.status})`);
      const payload = await response.json();
      return payload.data;
    },
  });

  const data = annual.data;
  const totals = data?.totals ?? {};

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
              {Array.from({ length: 5 }, (_, index) => currentYear - index).map((value) => (
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
              <Metric title="Annual pageviews" value={totals.pageviews} />
              <Metric title="Active editors" value={totals.editors} />
              <Metric title="Edits" value={totals.edits} />
              <Metric title="Estimated words added" value={totals.wordsAdded} />
              <Metric title="References added" value={totals.referencesAdded} />
              <Metric title="Commons uploads" value={totals.commonsUploads} />
            </section>

            <Card>
              <CardHeader>
                <CardTitle>Year-over-year comparison</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(data.totals).map(([key, value]) => (
                  <div className="rounded-lg border border-slate-200 p-3" key={key}>
                    <p className="text-xs uppercase tracking-wide text-slate-500">{key}</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {formatNumber(value)}
                    </p>
                    <p className="text-xs text-slate-500">Reported from reconciled source data</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Output by Wikipedia project</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-slate-500">
                        <th className="py-2">Project</th>
                        <th>Created</th>
                        <th>Edited</th>
                        <th>Views</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byWikiProject.map((row) => (
                        <tr className="border-b last:border-0" key={String(row.wikiProject)}>
                          <td className="py-2 font-medium">{String(row.wikiProject)}</td>
                          <td>{formatNumber(row.articlesCreated)}</td>
                          <td>{formatNumber(row.articlesEdited)}</td>
                          <td>{formatNumber(row.pageviews)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top viewed articles</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.topArticles?.length ? (
                    <ol className="space-y-3">
                      {data.topArticles.map((article) => (
                        <li
                          className="flex gap-3 border-b pb-2 last:border-0"
                          key={`${article.rank}-${article.title}-${article.wikiProject}`}
                        >
                          <span className="w-6 text-slate-400">{article.rank}.</span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{article.title}</p>
                            <p className="text-xs text-slate-500">
                              {article.wikiProject} · {formatNumber(article.totalPageviews)}{" "}
                              pageviews
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No historical pageview data is available for this year.
                    </p>
                  )}
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
                  statistics database for the selected calendar year.
                </p>
                <p>
                  Articles created means records marked as new by the Outreach source. Articles
                  edited includes tracked contribution activity. Pageviews are daily Wikimedia
                  pageview records aggregated for the period.
                </p>
                <p>
                  Estimated words added are derived from net byte changes and are an estimate, not a
                  linguistic word count. Financials, donations, grants, partnerships, editathons,
                  and AI research are outside this report.
                </p>
                <p>
                  Annual report figures may change after late upstream data, reconciliation, or
                  pageview backfills. Generated at request time from the current database snapshot.
                </p>
                <p>
                  Pageviews: {data.methodology.pageviews}. Articles created:{" "}
                  {data.methodology.articlesCreated}.
                </p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </>
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
