import type { PrismaClient } from "@repo/db";

export type AnnualReportData = {
  year: number;
  byWikiProject: Array<{
    wikiProject: string;
    edits: number;
    wordsAdded: number;
    pageviews: number;
    articlesCreated: number;
    articlesEdited: number;
    editors: number;
    referencesAdded: number;
    commonsUploads: number;
  }>;
  totals: {
    edits: number;
    wordsAdded: number;
    pageviews: number;
    articlesCreated: number;
    articlesEdited: number;
    editors: number;
    referencesAdded: number;
    commonsUploads: number;
  };
  yoy?: {
    articlesCreated: { current: number; previous: number; changePercent: number };
    pageviews: { current: number; previous: number; changePercent: number };
    wordsAdded: { current: number; previous: number; changePercent: number };
  };
  topArticles: Array<{
    rank: number;
    title: string;
    wikiProject: string;
    totalPageviews: number;
  }>;
};

export class ReportExportService {
  constructor(private readonly prisma: PrismaClient) {}

  async exportPDF(data: AnnualReportData): Promise<Buffer> {
    // TODO: Implement in Task 6
    throw new Error("Not implemented");
  }

  async exportCSV(data: AnnualReportData): Promise<string> {
    // TODO: Implement in Task 7
    throw new Error("Not implemented");
  }

  async exportJSON(data: AnnualReportData): Promise<string> {
    // TODO: Implement in Task 7
    throw new Error("Not implemented");
  }
}
