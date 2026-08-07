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
            <div className="h-48 w-full">
              <DailyChart data={daily} />
            </div>
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
      <div className="relative">
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
