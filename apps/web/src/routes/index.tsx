import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  FileText,
  PencilLine,
  RefreshCw,
  Users,
  Eye,
  UploadCloud,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-xs uppercase tracking-wider font-medium">{label}</span>
        </div>
        <p className="text-2xl font-bold text-slate-900 mt-2">{value}</p>
        {sub ? <p className="text-xs text-slate-500 mt-1">{sub}</p> : null}
      </CardContent>
    </Card>
  );
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
          <MetricCard icon={<PencilLine className="h-4 w-4" />} label="Edits" value={fmt(totals?.edits ?? 0)} sub={`${fmt(monthTotals?.edits ?? 0)} this month`} />
          <MetricCard icon={<FileText className="h-4 w-4" />} label="Words Added" value={fmtCompact(totals?.wordsAdded ?? 0)} sub={`${fmtCompact(monthTotals?.wordsAdded ?? 0)} this month`} />
          <MetricCard icon={<FileText className="h-4 w-4" />} label="Articles Created" value={fmt(totals?.articlesCreated ?? 0)} sub={`${fmt(monthTotals?.articlesCreated ?? 0)} this month`} />
          <MetricCard icon={<PencilLine className="h-4 w-4" />} label="Articles Edited" value={fmt(totals?.articlesEdited ?? 0)} sub={`${fmt(monthTotals?.articlesEdited ?? 0)} this month`} />
          <MetricCard icon={<Users className="h-4 w-4" />} label="Editors" value={fmt(totals?.editors ?? 0)} />
          <MetricCard icon={<UploadCloud className="h-4 w-4" />} label="Commons Uploads" value={fmt(totals?.commonsUploads ?? 0)} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricCard icon={<Eye className="h-4 w-4" />} label="Views (all articles)" value={fmtCompact(totals?.viewsTotal ?? 0)} sub={`${fmtCompact(monthTotals?.viewsTotal ?? 0)} this month`} />
        <MetricCard icon={<Eye className="h-4 w-4" />} label="Views (active articles)" value={fmtCompact(totals?.viewsActive ?? 0)} sub="articles created/edited in period" />
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
          <CardDescription>By edits (from snapshot detail)</CardDescription>
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
                    {fmt(a.edits)} edits · {fmtCompact(a.viewsTotal)} views
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DailyChart({ data }: { data: Array<{ periodStart: string; edits: number; viewsTotal: number }> }) {
  const maxEdits = Math.max(1, ...data.map((d) => d.edits));
  const maxViews = Math.max(1, ...data.map((d) => d.viewsTotal));
  return (
    <svg viewBox="0 0 800 180" className="w-full h-full" preserveAspectRatio="none">
      {data.map((d, i) => {
        const x = (i / Math.max(1, data.length - 1)) * 780 + 10;
        const hE = (d.edits / maxEdits) * 140;
        const hV = (d.viewsTotal / maxViews) * 140;
        return (
          <g key={d.periodStart}>
            <rect x={x - 2} y={170 - hE} width={4} height={hE} fill="#3b82f6" opacity={0.85}>
              <title>{`${d.periodStart}: ${d.edits} edits`}</title>
            </rect>
            <rect x={x - 2} y={170 - hV} width={4} height={hV} fill="#94a3b8" opacity={0.4}>
              <title>{`${d.periodStart}: ${d.viewsTotal.toLocaleString()} views`}</title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}
