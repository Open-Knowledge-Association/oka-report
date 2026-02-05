import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardStats } from "@/lib/api";

interface OutreachStatsProps {
  stats?: DashboardStats;
}

export function OutreachStats({ stats }: OutreachStatsProps) {
  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dashboard Statistics</CardTitle>
          <CardDescription>Loading local statistics...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dashboard Statistics</CardTitle>
        <CardDescription>Aggregated metrics from the local database</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <p className="text-2xl font-bold">{stats.editorsCount.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Editors</p>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold">{stats.totalEdits.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Edits</p>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold">{stats.articlesCreated.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Articles Created</p>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold">{stats.wordsAdded.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Words Added</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
