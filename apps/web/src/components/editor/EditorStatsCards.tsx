import { FileText, BookOpen, Eye, PencilLine, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EditorStats {
  articlesCount: number;
  totalEdits: number;
  editedArticlesCount: number;
  charactersAdded: number;
  referencesAdded: number;
  pageviews: number;
}

interface EditorStatsCardsProps {
  stats: EditorStats;
}

export function EditorStatsCards({ stats }: EditorStatsCardsProps) {
  const cards = [
    {
      title: "Total Edits",
      value: stats.totalEdits,
      icon: PencilLine,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Articles Created",
      value: stats.articlesCount,
      icon: FileText,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      title: "Articles Edited",
      value: stats.editedArticlesCount,
      icon: Layers,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
    },
    {
      title: "Characters Added",
      value: stats.charactersAdded,
      icon: BookOpen,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "References Added",
      value: stats.referencesAdded,
      icon: BookOpen,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Total Pageviews",
      value: stats.pageviews,
      icon: Eye,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  return (
    <div
      data-testid="editor-stats-cards"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4"
    >
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-slate-600">{card.title}</CardTitle>
            <div className={`p-2 rounded-lg ${card.bgColor}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{card.value.toLocaleString()}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
