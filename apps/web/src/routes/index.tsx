import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OutreachStats } from "@/components/outreach";
import { fetchOutreachCourse } from "@/lib/api";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  const {
    data: outreachData,
    isLoading: isLoadingOutreach,
    error,
  } = useQuery({
    queryKey: ["outreach", "course"],
    queryFn: fetchOutreachCourse,
  });

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-1">Overview of OKA Wikipedia contributions</p>
      </div>

      {isLoadingOutreach ? (
        <div className="text-center py-12">Loading Outreach statistics...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-600">
          Error loading statistics: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      ) : (
        <>
          <div className="mb-8">
            <OutreachStats course={outreachData?.course} />
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
