import { FileText, BookOpen, Eye, PencilLine, Layers, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
      tooltip:
        "Total revisions/edits made by this editor on program articles since enrollment (min. January 1, 2026). Source: Wikimedia contribution data (usercontribs).",
    },
    {
      title: "Articles Created",
      value: stats.articlesCount,
      icon: FileText,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      tooltip:
        "Number of new Wikipedia articles created by this editor, verified from Wikimedia contribution data (revision with parent revision 0) since enrollment. Consistent with snapshot reports.",
    },
    {
      title: "Articles Edited",
      value: stats.editedArticlesCount,
      icon: Layers,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
      tooltip:
        "Distinct articles this editor contributed to (created or edited) during the program — counted once per article.",
    },
    {
      title: "Characters Added",
      value: stats.charactersAdded,
      icon: BookOpen,
      color: "text-green-600",
      bgColor: "bg-green-50",
      tooltip:
        "Estimate of total words/characters added by this editor, derived from revision byte-size differences (sizediff) in the Wikimedia API.",
    },
    {
      title: "References Added",
      value: stats.referencesAdded,
      icon: BookOpen,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      tooltip:
        "Total references (citations) across all articles this editor created or edited. Each article's reference count is counted once.",
    },
    {
      title: "Total Pageviews",
      value: stats.pageviews,
      icon: Eye,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      tooltip:
        "Total pageviews of this editor's articles during the program window (since Jan 1, 2026, attributed from each article's first contribution). Views before the program touched an article are excluded. Source: snapshot pageview data, consistent with the dashboard.",
    },
  ];

  return (
    <TooltipProvider>
      <div
        data-testid="editor-stats-cards"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4"
      >
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-slate-600 flex items-center gap-1">
                {card.title}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help inline-flex">
                      <Info className="h-3 w-3 text-slate-400 hover:text-slate-600" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs leading-relaxed">{card.tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
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
    </TooltipProvider>
  );
}
