import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  Eye,
  FileText,
  PencilLine,
  RefreshCw,
  UploadCloud,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fetchSnapshotReport, fetchSnapshotDaily, fetchSyncStatus, type SnapshotTotals } from "@/lib/api";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

const fmt = (n: number) => (typeof n === "number" ? n.toLocaleString("en-US") : "0");
const fmtCompact = (n: number) => {
  if (typeof n !== "number") return "0";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

function MethodologyFlowChart() {
  const steps = [
    { title: "Program & Editors", sub: "Outreach Dashboard API", color: "#3b82f6" },
    { title: "Articles", sub: "Outreach Dashboard", color: "#3b82f6" },
    { title: "Contributions", sub: "Wikimedia usercontribs API", color: "#8b5cf6" },
    { title: "Commons Uploads", sub: "Wikimedia Commons API", color: "#8b5cf6" },
    { title: "Pageviews", sub: "Wikimedia pageviews API", color: "#0ea5e9" },
    { title: "Snapshots", sub: "Aggregation DAY/MONTH/YEAR", color: "#10b981" },
  ];
  // Layout: 6 kotak horizontal (2 baris: 3 atas, 3 bawah) — seperti diagram alur pipeline.
  const w = 180, h = 64, gapX = 60, gapY = 90;
  const positions = [
    { x: 0, y: 0 }, { x: w + gapX, y: 0 }, { x: (w + gapX) * 2, y: 0 },
    { x: (w + gapX) * 0.5, y: h + gapY }, { x: (w + gapX) * 1.5, y: h + gapY }, { x: (w + gapX) * 2.5, y: h + gapY },
  ];
  const totalW = (w + gapX) * 2 + w;
  const totalH = h * 2 + gapY;
  return (
    <div className="w-full overflow-x-auto py-2">
      <svg viewBox={`0 0 ${totalW + 40} ${totalH + 30}`} className="w-full min-w-[720px]" role="img" aria-label="Data pipeline flowchart">
        {/* panah baris 1 (3-> kanan) */}
        {[0, 1].map((i) => {
          const p1 = positions[i], p2 = positions[i + 1];
          return (
            <g key={`a1-${i}`}>
              <line x1={p1.x + w} y1={p1.y + h / 2} x2={p2.x - 6} y2={p2.y + h / 2} stroke="#94a3b8" strokeWidth={2} markerEnd="url(#arrow)" />
            </g>
          );
        })}
        {/* panah 3 -> 4 (turun miring) */}
        <line x1={positions[2].x + w / 2} y1={positions[2].y + h} x2={positions[3].x + w / 2} y2={positions[3].y - 6} stroke="#94a3b8" strokeWidth={2} markerEnd="url(#arrow)" />
        {/* panah baris 2 */}
        {[3, 4].map((i) => {
          const p1 = positions[i], p2 = positions[i + 1];
          return (
            <g key={`a2-${i}`}>
              <line x1={p1.x + w} y1={p1.y + h / 2} x2={p2.x - 6} y2={p2.y + h / 2} stroke="#94a3b8" strokeWidth={2} markerEnd="url(#arrow)" />
            </g>
          );
        })}
        {/* defs marker panah */}
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="#94a3b8" />
          </marker>
        </defs>
        {/* kotak */}
        {steps.map((s, i) => {
          const pos = positions[i];
          return (
            <g key={s.title}>
              <rect x={pos.x} y={pos.y} width={w} height={h} rx={10} fill={s.color} opacity={0.12} stroke={s.color} strokeWidth={1.5} />
              <text x={pos.x + w / 2} y={pos.y + 28} textAnchor="middle" fontSize={13} fontWeight={600} fill="#1e293b">{s.title}</text>
              <text x={pos.x + w / 2} y={pos.y + 46} textAnchor="middle" fontSize={10.5} fill="#64748b">{s.sub}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tooltip?: string;
}) {
  const content = (
    <Card className="h-full">
      <CardContent className="p-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 text-muted-foreground cursor-help">
              {icon}
              <span className="text-xs uppercase tracking-wider font-medium">{label}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-left leading-relaxed">
            {tooltip}
          </TooltipContent>
        </Tooltip>
        <p className="text-2xl font-bold text-slate-900 mt-2">{value}</p>
        {sub ? <p className="text-xs text-slate-500 mt-1">{sub}</p> : null}
      </CardContent>
    </Card>
  );
  return content;
}

function DashboardPage() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;
  const monthStart = `${year}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(now.getUTCMonth() + 2).padStart(2, "0")}-01`;

  const { data: yearly, isLoading: loadingYear } = useQuery({
    queryKey: ["snapshot", "year", year],
    queryFn: () => fetchSnapshotReport("YEAR", yearStart, yearEnd),
  });
  const { data: monthly } = useQuery({
    queryKey: ["snapshot", "month", monthStart],
    queryFn: () => fetchSnapshotReport("MONTH", monthStart, monthEnd),
  });
  const { data: daily, isLoading: loadingDaily } = useQuery({
    queryKey: ["snapshot", "daily", year],
    queryFn: () => fetchSnapshotDaily(`${year - 1}-12-31`, yearEnd),
  });
  const { data: syncStatus } = useQuery({
    queryKey: ["stats", "sync-status"],
    queryFn: fetchSyncStatus,
    refetchInterval: 30000,
  });

  const totals: SnapshotTotals | undefined = yearly?.totals;
  const monthTotals: SnapshotTotals | undefined = monthly?.totals;

  return (
    <TooltipProvider>
      <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-1">OKA program impact — {year}</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Badge variant="outline" className="gap-1 text-xs">
          <Activity className="h-3 w-3" />
          Snapshot {year}: {fmt(totals?.edits ?? 0)} edits
        </Badge>
        {syncStatus?.lastSync?.completedAt ? (
          <Badge variant="outline" className="gap-1 text-xs text-slate-500">
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            Last sync: {new Date(syncStatus.lastSync.completedAt).toLocaleString()}
          </Badge>
        ) : null}
      </div>

      {loadingYear ? (
        <div className="rounded-lg border border-slate-200 bg-white py-10 text-center text-sm text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin inline mr-2" />
          Loading statistics...
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard
            icon={<PencilLine className="h-4 w-4" />}
            label="Edits"
            value={fmt(totals?.edits ?? 0)}
            sub={`${fmt(monthTotals?.edits ?? 0)} this month`}
            tooltip="Total revisions/edits made by program editors on Wikipedia articles since January 1, 2026 (start of the OKA program). Source: Wikimedia contribution data (usercontribs), synced periodically."
          />
          <MetricCard
            icon={<FileText className="h-4 w-4" />}
            label="Words Added"
            value={fmtCompact(totals?.wordsAdded ?? 0)}
            sub={`${fmtCompact(monthTotals?.wordsAdded ?? 0)} this month`}
            tooltip="Estimated total words added by program editors to articles, computed from revision size differences (sizediff) in the Wikimedia API, since January 1, 2026."
          />
          <MetricCard
            icon={<FileText className="h-4 w-4" />}
            label="Articles Created"
            value={fmt(totals?.articlesCreated ?? 0)}
            sub={`${fmt(monthTotals?.articlesCreated ?? 0)} this month`}
            tooltip="Number of new articles created by program editors on Wikipedia (first revision of the article = parentid 0), since January 1, 2026."
          />
          <MetricCard
            icon={<PencilLine className="h-4 w-4" />}
            label="Articles Edited"
            value={fmt(totals?.articlesEdited ?? 0)}
            sub={`${fmt(monthTotals?.articlesEdited ?? 0)} this month`}
            tooltip="Number of unique articles that received contributions from program editors (created or edited), since January 1, 2026."
          />
          <MetricCard
            icon={<Users className="h-4 w-4" />}
            label="Editors"
            value={fmt(totals?.editors ?? 0)}
            tooltip="Number of registered OKA program editors with at least one contribution in the period (2026)."
          />
          <MetricCard
            icon={<UploadCloud className="h-4 w-4" />}
            label="Commons Uploads"
            value={fmt(totals?.commonsUploads ?? 0)}
            tooltip="Number of files (images, documents) uploaded by program editors to Wikimedia Commons since each editor's enrollment date (minimum January 1, 2026)."
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricCard
          icon={<Eye className="h-4 w-4" />}
          label="Views (all articles)"
          value={fmtCompact(totals?.viewsTotal ?? 0)}
          sub={`${fmtCompact(monthTotals?.viewsTotal ?? 0)} this month`}
          tooltip="Total pageviews of all program articles from Wikimedia, counted from the first program editor contribution on each article (cutoff), cumulative January 1, 2026 – now."
        />
        <MetricCard
          icon={<Eye className="h-4 w-4" />}
          label="Views (active articles)"
          value={fmtCompact(totals?.viewsActive ?? 0)}
          sub="articles created/edited in period"
          tooltip="Pageviews only for articles actively created/edited in the period (not all program articles). Shows the direct impact of contributions."
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-slate-900">Daily Activity — {year}</CardTitle>
          <CardDescription>
            Edits and views per day (from daily snapshots)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingDaily || !daily ? (
            <div className="py-8 text-center text-sm text-slate-400">Loading daily series...</div>
          ) : (
            <DailyChart data={daily} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-slate-900">Top Articles — {year}</CardTitle>
          <CardDescription>By pageviews (from snapshot detail)</CardDescription>
        </CardHeader>
        <CardContent>
          {!yearly?.topArticles?.length ? (
            <div className="py-6 text-center text-sm text-slate-400">No data yet</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {yearly.topArticles.map((a, i) => (
                <div key={a.articleId} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-slate-400 w-5">{i + 1}</span>
                    <span className="text-sm font-medium text-slate-800 truncate">{a.title}</span>
                    <Badge variant="outline" className="text-[10px] text-slate-400">{a.wikiProject.replace(".wikipedia.org", "")}</Badge>
                  </div>
                  <div className="text-sm text-slate-600 shrink-0">
                    {fmtCompact(a.viewsTotal)} views · {fmt(a.edits)} edits
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-slate-900">Methodology</CardTitle>
          <CardDescription>
            How the numbers on this dashboard are collected and computed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 text-sm text-slate-600 leading-relaxed">
          <MethodologyFlowChart />
          <div>
            <h3 className="font-semibold text-slate-800 mb-2">Data pipeline</h3>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>
                <strong>Program &amp; editors</strong> — Program members are pulled from the
                Outreach Dashboard API. Each editor's participation is counted from their
                enrollment date (clamped to January 1, 2026).
              </li>
              <li>
                <strong>Articles</strong> — The article list (51,755 articles) is synced from
                the Outreach Dashboard.
              </li>
              <li>
                <strong>Contributions</strong> — Each editor's edits are fetched from the
                Wikimedia <code>usercontribs</code> API. Words added are estimated from the
                revision size difference (<code>sizediff</code>); an article counts as{" "}
                <em>created</em> when its revision is the first in the article&apos;s history
                (parent revision id = 0).
              </li>
              <li>
                <strong>Commons uploads</strong> — Files uploaded by editors are fetched from
                the Wikimedia Commons API, counted from each editor&apos;s enrollment date.
              </li>
              <li>
                <strong>Pageviews</strong> — Daily pageview data (Wikimedia{" "}
                <code>DAILY/ALL_AGENTS</code>) is backfilled for every article that received a
                program contribution. Views are attributed from the date of the article&apos;s
                first program contribution (cutoff) onward — views before the program touched
                the article are excluded.
              </li>
              <li>
                <strong>Snapshots</strong> — A snapshot builder aggregates the raw data into
                daily, monthly and yearly metrics (edits, words, created/edited articles,
                views, editors, uploads) that power this dashboard.
              </li>
            </ol>
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 mb-2">Metric definitions</h3>
            <ul className="list-disc list-inside space-y-1.5">
              <li>
                <strong>Views (all articles)</strong> — pageviews of every program article
                since its first program contribution, cumulative for the period.
              </li>
              <li>
                <strong>Views (active articles)</strong> — pageviews of only the articles that
                were created or edited within the displayed period (direct impact of recent
                work).
              </li>
              <li>
                <strong>Edits / Articles Edited</strong> — counted only for contributions on or
                after the editor&apos;s enrollment date; an article counts once regardless of
                how many editors touched it.
              </li>
              <li>
                <strong>Articles Created</strong> — articles whose first-ever revision was made
                by a program editor (detected via parent revision id = 0).
              </li>
              <li>
                <strong>Top Articles</strong> — ranked by pageviews (total views during the
                period), with edit count shown alongside.
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 mb-2">Sync schedule</h3>
            <ul className="list-disc list-inside space-y-1.5">
              <li>Full data sync: daily at 02:00 (UTC).</li>
              <li>Outreach article sync: daily at 03:00 (UTC).</li>
              <li>Historical pageview backfill: weekly (Sundays) at 04:00 (UTC).</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 mb-2">Data sources</h3>
            <ul className="list-disc list-inside space-y-1.5">
              <li>
                <a
                  href="https://outreachdashboard.wmflabs.org/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  Outreach Dashboard API
                </a>{" "}
                — program, editors, article list.
              </li>
              <li>
                <a
                  href="https://www.mediawiki.org/wiki/API:Usercontribs"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  Wikimedia usercontribs API
                </a>{" "}
                — contribution history (edits, size diff, parent revision).
              </li>
              <li>
                <a
                  href="https://commons.wikimedia.org/w/api.php"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  Wikimedia Commons API
                </a>{" "}
                — file uploads by editors.
              </li>
              <li>
                <a
                  href="https://wikimedia.org/api/rest_v1/#/Pageviews%20data"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  Wikimedia Pageviews API (REST v1)
                </a>{" "}
                — daily pageviews (DAILY/ALL_AGENTS).
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 mb-2">Limitations</h3>
            <ul className="list-disc list-inside space-y-1.5">
              <li>
                <strong>Words Added</strong> is an <em>estimate</em>: it is derived from the
                revision byte-size difference (sizediff) via the Wikimedia API, not from
                actual word counting. Size changes from templates, categories or formatting
                can influence the value.
              </li>
              <li>
                <strong>Pageview coverage</strong> starts at each article&apos;s first program
                contribution (cutoff). Pageviews before the program touched an article are
                intentionally excluded — figures therefore represent program-attributed views,
                not total article lifetime views.
              </li>
              <li>
                <strong>Data freshness</strong> depends on the last completed sync. Numbers
                reflect the state at the last snapshot (see &quot;Last sync&quot; badge on the
                dashboard) and may lag live Wikimedia data by up to a day.
              </li>
              <li>
                <strong>Commons uploads</strong> only include uploads made after each
                editor&apos;s enrollment date; earlier uploads are outside the program window.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
      </div>
    </TooltipProvider>
  );
}

function DailyChart({ data }: { data: Array<{ periodStart: string; edits: number; viewsTotal: number }> }) {
  const maxEdits = Math.max(1, ...data.map((d) => d.edits));
  const maxViews = Math.max(1, ...data.map((d) => d.viewsTotal));
  const [hovered, setHovered] = React.useState<number | null>(null);
  return (
    <div>
      <div className="flex items-center justify-end gap-4 mb-2 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" /> Edits
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-400/60" /> Views
        </span>
      </div>
      <div className="relative h-48 w-full">
        <svg viewBox="0 0 800 180" className="w-full h-full" preserveAspectRatio="none">
          {data.map((d, i) => {
            const x = (i / Math.max(1, data.length - 1)) * 780 + 10;
            const hE = (d.edits / maxEdits) * 140;
            const hV = (d.viewsTotal / maxViews) * 140;
            return (
              <g
                key={d.periodStart}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                className="cursor-pointer"
              >
                <rect x={x - 2} y={170 - hE} width={4} height={hE} fill="#3b82f6" opacity={0.85} />
                <rect x={x - 2} y={170 - hV} width={4} height={hV} fill="#94a3b8" opacity={0.4} />
              </g>
            );
          })}
        </svg>
        {hovered !== null && data[hovered] ? (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white shadow"
            style={{ left: `${(hovered / Math.max(1, data.length - 1)) * 100}%`, transform: "translateX(-50%)" }}
          >
            <div className="font-medium">{new Date(data[hovered].periodStart).toLocaleDateString()}</div>
            <div>Edits: {data[hovered].edits.toLocaleString()}</div>
            <div>Views: {data[hovered].viewsTotal.toLocaleString()}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
