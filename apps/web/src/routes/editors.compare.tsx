import { useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users } from "lucide-react";

interface EditorProfile {
  editor: {
    id: string;
    username: string;
    wiki: string;
  };
  outreachStats: {
    articlesCount: number;
    totalEdits: number;
    charactersAdded: number;
    referencesAdded: number;
    pageviews: number;
  };
}

export const Route = createFileRoute("/editors/compare")({
  component: CompareEditorsPage,
});

const MetricRow = ({
  label,
  value1,
  value2,
}: {
  label: string;
  value1: number;
  value2: number;
}) => {
  const diff = value2 - value1;
  const percent = value1 === 0 ? 0 : ((value2 - value1) / value1) * 100;
  const isPositive = diff > 0;

  return (
    <div className="grid grid-cols-3 gap-4 py-3 border-b border-slate-100 last:border-0 items-center">
      <div className="text-right font-mono text-slate-700">{value1.toLocaleString()}</div>
      <div className="text-center text-sm font-medium text-slate-500">{label}</div>
      <div className="text-left font-mono text-slate-700 flex items-center gap-2">
        {value2.toLocaleString()}
        {diff !== 0 && (
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${
              isPositive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
            }`}
          >
            {isPositive ? "+" : ""}
            {percent.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
};

export function CompareEditorsPage() {
  const search = useSearch({ from: "/editors/compare" });
  const ids = (search as { ids?: string }).ids?.split(",").filter(Boolean) || [];

  const { data: editor1, isLoading: loading1 } = useQuery({
    queryKey: ["editor", "profile", ids[0]],
    queryFn: async () => {
      if (!ids[0]) return null;
      const response = await fetch(`/api/editors/${ids[0]}/profile`);
      if (!response.ok) throw new Error("Failed to fetch editor 1");
      const result = await response.json();
      return result.data as EditorProfile;
    },
    enabled: !!ids[0],
  });

  const { data: editor2, isLoading: loading2 } = useQuery({
    queryKey: ["editor", "profile", ids[1]],
    queryFn: async () => {
      if (!ids[1]) return null;
      const response = await fetch(`/api/editors/${ids[1]}/profile`);
      if (!response.ok) throw new Error("Failed to fetch editor 2");
      const result = await response.json();
      return result.data as EditorProfile;
    },
    enabled: !!ids[1],
  });

  if (ids.length !== 2) {
    return (
      <>
        <div className="mx-auto w-full max-w-6xl py-16 text-center">
          <Users className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Compare Editors</h1>
          <p className="text-slate-600 mb-6">
            Select 2 editors to compare their contributions side-by-side.
          </p>
          <Button asChild>
            <Link to="/editors">Browse Editors</Link>
          </Button>
        </div>
      </>
    );
  }

  if (loading1 || loading2) {
    return (
      <>
        <div className="mx-auto w-full max-w-6xl py-16 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 rounded w-1/3 mx-auto" />
            <div className="h-64 bg-slate-200 rounded" />
          </div>
        </div>
      </>
    );
  }

  if (!editor1 || !editor2) {
    return (
      <>
        <div className="mx-auto w-full max-w-6xl py-16 text-center">
          <p className="text-red-600">Failed to load editor data.</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link to="/editors">Back to Editors</Link>
          </Button>
        </div>
      </>
    );
  }

  const chartData = [
    {
      metric: "Articles",
      [editor1.editor.username]: editor1.outreachStats.articlesCount,
      [editor2.editor.username]: editor2.outreachStats.articlesCount,
    },
    {
      metric: "Characters",
      [editor1.editor.username]: editor1.outreachStats.charactersAdded,
      [editor2.editor.username]: editor2.outreachStats.charactersAdded,
    },
    {
      metric: "References",
      [editor1.editor.username]: editor1.outreachStats.referencesAdded,
      [editor2.editor.username]: editor2.outreachStats.referencesAdded,
    },
    {
      metric: "Pageviews",
      [editor1.editor.username]: editor1.outreachStats.pageviews,
      [editor2.editor.username]: editor2.outreachStats.pageviews,
    },
  ];

  return (
    <>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/editors">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-slate-900">Compare Editors</h1>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Side-by-Side Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 pb-4 border-b border-slate-200 mb-4">
                <div className="text-right font-bold text-lg text-slate-900">
                  {editor1.editor.username}
                </div>
                <div className="text-center text-sm text-slate-500 uppercase tracking-wider font-medium">
                  Metric
                </div>
                <div className="text-left font-bold text-lg text-slate-900">
                  {editor2.editor.username}
                </div>
              </div>

              <MetricRow
                label="Articles"
                value1={editor1.outreachStats.articlesCount}
                value2={editor2.outreachStats.articlesCount}
              />
              <MetricRow
                label="Characters"
                value1={editor1.outreachStats.charactersAdded}
                value2={editor2.outreachStats.charactersAdded}
              />
              <MetricRow
                label="References"
                value1={editor1.outreachStats.referencesAdded}
                value2={editor2.outreachStats.referencesAdded}
              />
              <MetricRow
                label="Pageviews"
                value1={editor1.outreachStats.pageviews}
                value2={editor2.outreachStats.pageviews}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Comparison Chart</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
                  <YAxis
                    width={60}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) =>
                      value >= 1000000
                        ? `${(value / 1000000).toFixed(1)}M`
                        : value >= 1000
                          ? `${(value / 1000).toFixed(1)}K`
                          : value
                    }
                  />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                    formatter={(value: number | undefined) => (value ?? 0).toLocaleString()}
                  />
                  <Legend />
                  <Bar
                    dataKey={editor1.editor.username}
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                    name={editor1.editor.username}
                  />
                  <Bar
                    dataKey={editor2.editor.username}
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    name={editor2.editor.username}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
