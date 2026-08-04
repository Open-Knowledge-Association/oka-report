import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, BookOpen, GitCompare, Activity, FileText, Database } from "lucide-react";

export const Route = createFileRoute("/help")({
  component: HelpPage,
});

const dailyWorkflow = [
  {
    title: "Start with data refresh",
    detail: "Run full sync in Sync Jobs. Use targeted jobs only when one metric domain is stale.",
  },
  {
    title: "Watch execution health",
    detail: "Check parent/child statuses, failed stage, and job metadata in Sync Jobs.",
  },
  {
    title: "Rebuild snapshots when needed",
    detail: "Run history_backfill after major syncs, bug fixes, or date-range repairs.",
  },
  {
    title: "Validate all reporting surfaces",
    detail:
      "Review Dashboard, Editors, Articles, and History for consistency before sharing results.",
  },
];

const syncPlaybook = [
  {
    symptom: "Views exist but edits/words are zero for one wiki",
    run: "contributions -> history_backfill",
    why: "Contributions table is stale while pageviews are fresh.",
  },
  {
    symptom: "Uploads are zero everywhere",
    run: "commons -> history_backfill",
    why: "commons_uploads drives upload metrics and snapshots.",
  },
  {
    symptom: "History daily table looks wrong after fixes",
    run: "history_backfill for affected range",
    why: "Snapshot tables must be recomputed from source tables.",
  },
  {
    symptom: "Full sync failed in middle stage",
    run: "retry failed child job, then optional history_backfill",
    why: "Fast recovery avoids unnecessary full rerun.",
  },
  {
    symptom: "Article/editor counts differ from Outreach",
    run: "editors + outreach_articles + contributions",
    why: "Roster/catalog/linkage might be out of date.",
  },
];

const featureGuide = [
  {
    name: "Dashboard",
    purpose: "KPI summary + sync health + drift diagnostics.",
    notes:
      "Use Raw Verification Data and JSON links when drift looks suspicious. Upload drift is informational due to source-scope differences.",
    icon: Activity,
  },
  {
    name: "Editors",
    purpose: "Per-editor cumulative stats from local DB.",
    notes:
      "Shows current totals. Editor roster is sync-managed (manual admin editor pages are deprecated).",
    icon: FileText,
  },
  {
    name: "Articles",
    purpose: "Article inventory and lifetime article-level metrics.",
    notes:
      "Outreach articles prefer their latest cumulative total; MediaWiki articles sum daily ALL_AGENTS rows.",
    icon: BookOpen,
  },
  {
    name: "History",
    purpose: "Daily, monthly, annual analytics from snapshot tables.",
    notes:
      "Use tabs for Reports/Daily/Entity/Utilities. Backfill range after source-table changes.",
    icon: Database,
  },
  {
    name: "Sync Jobs",
    purpose: "Operational control center for all data pipelines.",
    notes:
      "Supports trigger, retry, cancel, delete, and progress tracking (stage/processed/total).",
    icon: GitCompare,
  },
];

const syncJobImpact = [
  {
    job: "editors",
    impact: "Sync active editor roster from Outreach participants.",
    outputs: "editors",
  },
  {
    job: "outreach_articles",
    impact: "Sync article catalog and Outreach metadata/cumulative views.",
    outputs: "articles, article_editors, pageviews(CUMULATIVE)",
  },
  {
    job: "contributions",
    impact: "Sync revisions/edits/words and creator linkage (multi-wiki).",
    outputs: "contributions, articles(createdByEditorId/pageId)",
  },
  {
    job: "pageviews",
    impact: "Sync daily pageviews from Wikimedia pageviews API.",
    outputs: "pageviews(DAILY, USER+ALL_AGENTS), sync job metadata",
  },
  {
    job: "commons",
    impact: "Sync Commons uploads per tracked editor.",
    outputs: "commons_uploads",
  },
  {
    job: "history_backfill",
    impact: "Recompute snapshot tables for date range.",
    outputs:
      "daily_stats, daily_wiki_stats, daily_source_stats, daily_wiki_source_stats, editor_daily_stats, article_daily_stats",
  },
  {
    job: "full",
    impact: "Run core jobs in sequence with parent/child tracking.",
    outputs: "All sync domains refreshed in one pipeline",
  },
];

const metricDefinitions = [
  {
    metric: "Editors",
    definition: "Active editor records in local DB.",
  },
  {
    metric: "Articles Created",
    definition: "Unique articles with a tracked first-revision contribution.",
  },
  {
    metric: "Edits",
    definition: "Number of tracked revisions from contributions table.",
  },
  {
    metric: "Words Added",
    definition: "Approximation from tracked contribution byte deltas (positive bytes / 6).",
  },
  {
    metric: "Views",
    definition: "Lifetime or selected-period ALL_AGENTS totals, according to page context.",
  },
  {
    metric: "Refs",
    definition: "Reference counts from article metadata/snapshots.",
  },
  {
    metric: "Uploads",
    definition: "Commons uploads from local history; Outreach comparator may use narrower scope.",
  },
];

function HelpPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Help Guide</h1>
        <p className="text-slate-600 mt-1">
          Complete operational guide for sync workflow, feature behavior, reports, and
          troubleshooting.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Daily Workflow */}
          <Card id="daily-workflow">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="text-lg font-semibold text-slate-900">
                Recommended Daily Workflow
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {dailyWorkflow.map((step, index) => (
                  <div key={step.title} className="flex gap-4">
                    <div className="flex-none flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold text-sm border border-slate-200">
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900">{step.title}</h4>
                      <p className="text-sm text-slate-500 mt-1 leading-relaxed">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Sync Playbook */}
          <Card id="sync-playbook">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="text-lg font-semibold text-slate-900">
                Sync Troubleshooting Playbook
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[300px] font-semibold text-slate-700">
                        Symptom
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700">Action</TableHead>
                      <TableHead className="font-semibold text-slate-700">Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncPlaybook.map((item) => (
                      <TableRow key={item.symptom} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium text-slate-900 text-sm align-top">
                          {item.symptom}
                        </TableCell>
                        <TableCell className="align-top">
                          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-slate-700 break-words">
                            {item.run}
                          </code>
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm align-top">
                          {item.why}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Sync Job Impact */}
          <Card id="sync-impact">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="text-lg font-semibold text-slate-900">
                Sync Job Impact
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid gap-4">
                {syncJobImpact.map((row) => (
                  <div
                    key={row.job}
                    className="flex flex-col sm:flex-row gap-4 p-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="sm:w-48 flex-none">
                      <Badge
                        variant="outline"
                        className="font-mono text-xs bg-slate-50 text-slate-700 border-slate-200"
                      >
                        {row.job}
                      </Badge>
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-medium text-slate-900">{row.impact}</p>
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mt-0.5">
                          Outputs:
                        </span>
                        <p className="text-xs text-slate-500 font-mono break-all">{row.outputs}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Quick Nav */}
          <Card className="bg-slate-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium text-slate-900">
                Quick Navigation
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {[
                { href: "#daily-workflow", label: "Daily Workflow" },
                { href: "#sync-playbook", label: "Troubleshooting Playbook" },
                { href: "#sync-impact", label: "Sync Job Impact" },
                { href: "#feature-guide", label: "Feature Guide" },
                { href: "#metric-definitions", label: "Metric Definitions" },
                { href: "#reference-links", label: "Reference Links" },
              ].map((link) => (
                <Button
                  key={link.href}
                  variant="ghost"
                  size="sm"
                  className="justify-start h-8 px-2 text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200"
                  asChild
                >
                  <a href={link.href}>{link.label}</a>
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Feature Guide */}
          <Card id="feature-guide">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="text-lg font-semibold text-slate-900">Feature Guide</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {featureGuide.map((item) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <item.icon className="w-4 h-4 text-slate-400" />
                    <h4 className="font-medium text-sm text-slate-900">{item.name}</h4>
                  </div>
                  <p className="text-xs text-slate-600 pl-6">{item.purpose}</p>
                  <p className="text-[10px] text-slate-400 pl-6 italic">{item.notes}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Metric Definitions */}
          <Card id="metric-definitions">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="text-lg font-semibold text-slate-900">Metrics</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {metricDefinitions.map((row) => (
                <div key={row.metric} className="group">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 group-hover:text-slate-700 transition-colors">
                    {row.metric}
                  </h4>
                  <p className="text-sm text-slate-600 leading-snug">{row.definition}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Reference Links */}
          <Card id="reference-links">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="text-lg font-semibold text-slate-900">Resources</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 h-auto py-3 text-left"
                asChild
              >
                <a href="/api/stats/sync-status" target="_blank" rel="noreferrer">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="text-sm font-medium text-slate-900">Sync Status JSON</span>
                    <span className="text-xs text-slate-500">Live operational status</span>
                  </div>
                  <ExternalLink className="w-3 h-3 ml-auto text-slate-300" />
                </a>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 h-auto py-3 text-left"
                asChild
              >
                <a href="/api/stats/uploads-reconcile?limit=50" target="_blank" rel="noreferrer">
                  <Database className="w-4 h-4 text-blue-500" />
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="text-sm font-medium text-slate-900">
                      Upload Reconciliation
                    </span>
                    <span className="text-xs text-slate-500">Commons vs Local check</span>
                  </div>
                  <ExternalLink className="w-3 h-3 ml-auto text-slate-300" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
