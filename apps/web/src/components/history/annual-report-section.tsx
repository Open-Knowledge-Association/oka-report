import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { downloadAnnualReport } from "@/lib/api";

export function AnnualReportSection() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [wikiProject, setWikiProject] = useState("");
  const [format, setFormat] = useState<"pdf" | "csv" | "json">("pdf");
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    setIsLoading(true);
    try {
      const blob = await downloadAnnualReport({ year, format, wikiProject });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `oka-annual-report-${year}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const yearOptions = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Annual Report</CardTitle>
        <p className="text-sm text-muted-foreground">Generate and download annual reports</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="space-y-2">
            <Label>Year</Label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Wiki Project (Optional)</Label>
            <Input
              value={wikiProject}
              onChange={(e) => setWikiProject(e.target.value)}
              placeholder="e.g., id.wikipedia.org"
            />
          </div>
          <div className="space-y-2">
            <Label>Format</Label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as "pdf" | "csv" | "json")}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="pdf">PDF</option>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleExport} disabled={isLoading} className="w-full">
              {isLoading ? "Generating..." : "Generate Report"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
