import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, FileText, Eye, TrendingUp, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchOverallStats } from "@/lib/api";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["stats", "overall"],
    queryFn: fetchOverallStats,
  });

  const stats = data?.totals;

  const statCards = [
    {
      title: "Total Editors",
      value: stats?.editorsCount ?? "-",
      icon: Users,
      description: "Active Wikipedia editors",
    },
    {
      title: "Articles Created",
      value: stats?.articlesCreated ?? "-",
      icon: FileText,
      description: "By tracked editors",
    },
    {
      title: "Total Edits",
      value: stats?.edits ?? "-",
      icon: TrendingUp,
      description: "Contributions tracked",
    },
    {
      title: "Page Views",
      value: stats?.pageviews ? `${(stats.pageviews / 1000).toFixed(1)}K` : "-",
      icon: Eye,
      description: "Total article views",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-1">Overview of OKA Wikipedia contributions</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Loading dashboard...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statCards.map((card) => (
              <Card key={card.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                  <card.icon className="h-4 w-4 text-slate-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{card.value}</div>
                  <p className="text-xs text-slate-500">{card.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button asChild className="w-full justify-between">
                  <a href="/admin/editors">
                    Manage Editors
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
                <Button asChild variant="outline" className="w-full justify-between">
                  <a href="/admin/editors/new">
                    Add New Editor
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
                <Button asChild variant="outline" className="w-full justify-between">
                  <a href="/editors">
                    View Editor Stats
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>About OKA Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 mb-4">
                  This platform tracks Wikipedia editing contributions from OKA (Open Knowledge
                  Association) members and grant recipients.
                </p>
                <p className="text-sm text-slate-600">
                  Metrics include edits, words added, pageviews, articles created, and Wikimedia
                  Commons uploads.
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
