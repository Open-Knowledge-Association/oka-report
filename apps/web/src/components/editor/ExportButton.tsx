import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Article {
  id: string;
  title: string;
  url: string;
  wikiProject?: string;
  language?: string;
  project?: string;
  characterSum: number;
  referencesCount: number;
  isNewArticle?: boolean;
  rating?: string | null;
}

interface DailyStat {
  date: string;
  edits: number;
  wordsAdded: number;
  articlesCreated: number;
  articlesEdited: number;
  referencesAdded: number;
  commonsUploads: number;
}

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
  articles: Article[];
  dailyStats?: DailyStat[];
}

interface ExportButtonProps {
  profile: EditorProfile;
}

const csvCell = (value: unknown) => {
  const raw = String(value ?? "");
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
};

export function ExportButton({ profile }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const generateCSV = () => {
    const { editor, outreachStats, articles, dailyStats } = profile;
    const date = new Date().toISOString().split("T")[0];

    let csv = "Editor Profile Export\n";
    csv += `Generated: ${date}\n\n`;

    csv += "SUMMARY\n";
    csv += "Username,Articles,Characters Added,References Added,Pageviews\n";
    csv +=
      [
        editor.username,
        outreachStats.articlesCount,
        outreachStats.charactersAdded,
        outreachStats.referencesAdded,
        outreachStats.pageviews,
      ]
        .map(csvCell)
        .join(",") + "\n\n";

    csv += "ARTICLES\n";
    csv += "Title,Wiki,Characters,References,Rating,Status\n";
    articles.forEach((article) => {
      const wiki = article.wikiProject
        ? article.wikiProject.replace(".org", "")
        : `${article.language}.${article.project}`;
      csv +=
        [
          article.title,
          wiki,
          article.characterSum,
          article.referencesCount,
          article.rating || "",
          article.isNewArticle ? "Created" : "Edited",
        ]
          .map(csvCell)
          .join(",") + "\n";
    });

    if (dailyStats && dailyStats.length > 0) {
      csv += "\nDAILY STATS\n";
      csv +=
        "Date,Edits,Words Added,Articles Created,Articles Edited,References Added,Commons Uploads\n";
      dailyStats.forEach((stat) => {
        csv +=
          [
            stat.date,
            stat.edits,
            stat.wordsAdded,
            stat.articlesCreated,
            stat.articlesEdited,
            stat.referencesAdded,
            stat.commonsUploads,
          ]
            .map(csvCell)
            .join(",") + "\n";
      });
    }

    return csv;
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const csv = generateCSV();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().split("T")[0];

      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `editor-${profile.editor.username.replace(/[^a-zA-Z0-9._-]/g, "_")}-${date}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export successful",
        description: `Downloaded editor-${profile.editor.username.replace(/[^a-zA-Z0-9._-]/g, "_")}-${date}.csv`,
      });
    } catch {
      toast({
        title: "Export failed",
        description: "Failed to generate CSV file",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      data-testid="export-button"
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
    >
      <Download className="w-4 h-4 mr-2" />
      {isExporting ? "Exporting..." : "Export CSV"}
    </Button>
  );
}
