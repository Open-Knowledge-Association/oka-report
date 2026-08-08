import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { SnapshotReport, SnapshotTotals } from "@/lib/api";

const csvCell = (value: unknown) => {
  const raw = String(value ?? "");
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
};

interface AnnualReportExportProps {
  year: number;
  report: SnapshotReport;
  editors: Array<{
    editorId: string;
    username: string;
    edits: number;
    wordsAdded: number;
    articlesCreated: number;
    articlesEdited: number;
    commonsUploads: number;
  }>;
}

export function AnnualReportExport({ year, report, editors }: AnnualReportExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const generateCSV = () => {
    const totals: SnapshotTotals = report.totals;
    const date = new Date().toISOString().split("T")[0];

    let csv = `OKA Annual Report ${year}\n`;
    csv += `Generated: ${date}\n\n`;

    csv += "SUMMARY\n";
    csv +=
      "Metric,Value\n" +
      `"Articles created",${csvCell(totals.articlesCreated)}\n` +
      `"Articles edited",${csvCell(totals.articlesEdited)}\n` +
      `"Views (all articles)",${csvCell(totals.viewsTotal)}\n` +
      `"Views (active articles)",${csvCell(totals.viewsActive)}\n` +
      `"Active editors",${csvCell(totals.editors)}\n` +
      `"Edits",${csvCell(totals.edits)}\n` +
      `"Estimated words added",${csvCell(totals.wordsAdded)}\n` +
      `"Commons uploads",${csvCell(totals.commonsUploads)}\n\n`;

    csv += "MONTHLY BREAKDOWN\n";
    csv +=
      "Month,Edits,Words,Created,Edited,Editors,Views (total),Views (active),Uploads\n";
    report.byPeriod.forEach((row) => {
      csv +=
        [
          new Date(row.periodStart).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          }),
          row.edits,
          row.wordsAdded,
          row.articlesCreated,
          row.articlesEdited,
          row.editors,
          row.viewsTotal,
          row.viewsActive,
          row.commonsUploads,
        ]
          .map(csvCell)
          .join(",") + "\n";
    });

    if (report.topArticles?.length) {
      csv += "\nTOP EDITED ARTICLES\n";
      csv += "Rank,Title,Wiki,Edits,Views\n";
      report.topArticles.forEach((article, i) => {
        csv +=
          [i + 1, article.title, article.wikiProject, article.edits, article.viewsTotal]
            .map(csvCell)
            .join(",") + "\n";
      });
    }

    if (editors.length) {
      csv += "\nEDITOR LEADERBOARD\n";
      csv += "Rank,Username,Edits,Words,Created,Edited,Commons Uploads\n";
      editors.forEach((e, i) => {
        csv +=
          [
            i + 1,
            e.username,
            e.edits,
            e.wordsAdded,
            e.articlesCreated,
            e.articlesEdited,
            e.commonsUploads ?? 0,
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
      link.setAttribute("download", `oka-annual-report-${year}-${date}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({
        title: "Export successful",
        description: `Downloaded oka-annual-report-${year}-${date}.csv`,
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
      data-testid="annual-export-button"
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
