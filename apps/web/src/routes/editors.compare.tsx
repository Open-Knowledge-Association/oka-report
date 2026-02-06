import { useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users } from "lucide-react";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

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

function CompareEditorsPage() {
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
    );
  }

  if (loading1 || loading2) {
    return (
      <div className="mx-auto w-full max-w-6xl py-16 text-center">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3 mx-auto" />
          <div className="h-64 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  if (!editor1 || !editor2) {
    return (
      <div className="mx-auto w-full max-w-6xl py-16 text-center">
        <p className="text-red-600">Failed to load editor data.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link to="/editors">Back to Editors</Link>
        </Button>
      </div>
    );
  }

  const comparisonData = {
    labels: ["Articles", "Characters", "References", "Pageviews"],
    datasets: [
      {
        label: editor1.editor.username,
        data: [
          editor1.outreachStats.articlesCount,
          editor1.outreachStats.charactersAdded,
          editor1.outreachStats.referencesAdded,
          editor1.outreachStats.pageviews,
        ],
        backgroundColor: "rgba(59, 130, 246, 0.8)",
        borderColor: "rgb(59, 130, 246)",
        borderWidth: 1,
      },
      {
        label: editor2.editor.username,
        data: [
          editor2.outreachStats.articlesCount,
          editor2.outreachStats.charactersAdded,
          editor2.outreachStats.referencesAdded,
          editor2.outreachStats.pageviews,
        ],
        backgroundColor: "rgba(16, 185, 129, 0.8)",
        borderColor: "rgb(16, 185, 129)",
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: "Editor Comparison",
      },
      legend: {
        position: "top" as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link to="/editors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Compare Editors</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[editor1, editor2].map((editor) => (
          <Card key={editor.editor.id}>
            <CardHeader>
              <CardTitle>{editor.editor.username}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-600">Articles</p>
                  <p className="text-xl font-bold">
                    {editor.outreachStats.articlesCount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Characters</p>
                  <p className="text-xl font-bold">
                    {editor.outreachStats.charactersAdded.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">References</p>
                  <p className="text-xl font-bold">
                    {editor.outreachStats.referencesAdded.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Pageviews</p>
                  <p className="text-xl font-bold">
                    {editor.outreachStats.pageviews.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comparison Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <Bar data={comparisonData} options={chartOptions} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
