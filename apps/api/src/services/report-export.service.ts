import type { PrismaClient } from "@repo/db/generated/prisma/client";

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
    const puppeteer = await import("puppeteer");
    let browser;

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
      });
      const page = await browser.newPage();
      const html = this.generateHTML(data);

      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "20px", right: "20px", bottom: "20px", left: "20px" },
      });

      return Buffer.from(pdf);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private generateHTML(data: AnnualReportData): string {
    const { year, totals, byWikiProject, topArticles } = data;
    const fmt = (value: number | null | undefined) => value == null ? "Unavailable" : value.toLocaleString();

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>OKA Annual Report ${year}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
      color: #333;
    }
    h1 {
      color: #333;
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
    }
    h2 {
      color: #555;
      margin-top: 30px;
      margin-bottom: 15px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 10px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
      font-weight: bold;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    .number {
      text-align: right;
    }
    .footer {
      margin-top: 40px;
      font-size: 12px;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <h1>OKA Annual Report ${year}</h1>
  
  <h2>Summary Statistics</h2>
  <table>
    <thead>
      <tr>
        <th>Metric</th>
        <th class="number">Value</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Total Edits</td>
        <td class="number">${fmt(totals.edits)}</td>
      </tr>
      <tr>
        <td>Words Added</td>
        <td class="number">${fmt(totals.wordsAdded)}</td>
      </tr>
      <tr>
        <td>Pageviews</td>
        <td class="number">${fmt(totals.pageviews)}</td>
      </tr>
      <tr>
        <td>Articles Created</td>
        <td class="number">${fmt(totals.articlesCreated)}</td>
      </tr>
      <tr>
        <td>Articles Edited</td>
        <td class="number">${fmt(totals.articlesEdited)}</td>
      </tr>
      <tr>
        <td>Active Editors</td>
        <td class="number">${fmt(totals.editors)}</td>
      </tr>
      <tr>
        <td>References Added</td>
        <td class="number">${fmt(totals.referencesAdded)}</td>
      </tr>
      <tr>
        <td>Commons Uploads</td>
        <td class="number">${fmt(totals.commonsUploads)}</td>
      </tr>
    </tbody>
  </table>
  
  <h2>Breakdown by Wikipedia Project</h2>
  <table>
    <thead>
      <tr>
        <th>Wiki Project</th>
        <th class="number">Edits</th>
        <th class="number">Words Added</th>
        <th class="number">Pageviews</th>
        <th class="number">Articles Created</th>
        <th class="number">Articles Edited</th>
        <th class="number">Editors</th>
      </tr>
    </thead>
    <tbody>
      ${byWikiProject
        .map(
          (wiki) => `
        <tr>
          <td>${wiki.wikiProject}</td>
          <td class="number">${fmt(wiki.edits)}</td>
          <td class="number">${fmt(wiki.wordsAdded)}</td>
          <td class="number">${fmt(wiki.pageviews)}</td>
          <td class="number">${fmt(wiki.articlesCreated)}</td>
          <td class="number">${fmt(wiki.articlesEdited)}</td>
          <td class="number">${fmt(wiki.editors)}</td>
        </tr>
      `,
        )
        .join("")}
    </tbody>
  </table>
  
  <h2>Top Articles by Pageviews</h2>
  <table>
    <thead>
      <tr>
        <th>Rank</th>
        <th>Article Title</th>
        <th>Wiki Project</th>
        <th class="number">Total Pageviews</th>
      </tr>
    </thead>
    <tbody>
      ${topArticles
        .map(
          (article) => `
        <tr>
          <td>${article.rank}</td>
          <td>${article.title}</td>
          <td>${article.wikiProject}</td>
          <td class="number">${fmt(article.totalPageviews)}</td>
        </tr>
      `,
        )
        .join("")}
    </tbody>
  </table>
  
  <div class="footer">
    <p>Generated on ${new Date().toLocaleDateString()} by OKA Stats Platform</p>
  </div>
</body>
</html>
    `.trim();
  }

  async exportCSV(data: AnnualReportData): Promise<string> {
    const headers = [
      "Wiki Project",
      "Articles Created",
      "Articles Edited",
      "Edits",
      "Words Added",
      "Pageviews",
      "Editors",
      "References Added",
      "Commons Uploads",
    ];

    const rows = data.byWikiProject.map((project) => [
      project.wikiProject,
      project.articlesCreated,
      project.articlesEdited,
      project.edits,
      project.wordsAdded,
      project.pageviews,
      project.editors,
      project.referencesAdded,
      project.commonsUploads,
    ]);

    // Add totals row
    rows.push([
      "TOTAL",
      data.totals.articlesCreated,
      data.totals.articlesEdited,
      data.totals.edits,
      data.totals.wordsAdded,
      data.totals.pageviews,
      data.totals.editors,
      data.totals.referencesAdded,
      data.totals.commonsUploads,
    ]);

    // Convert to CSV format with proper escaping
    const escapeCSV = (value: string | number) => {
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [headers.join(","), ...rows.map((row) => row.map(escapeCSV).join(","))].join(
      "\n",
    );

    return csvContent;
  }

  async exportJSON(data: AnnualReportData): Promise<string> {
    const report = {
      metadata: {
        year: data.year,
        generatedAt: new Date().toISOString(),
        version: "1.0",
      },
      summary: data.totals,
      byWikiProject: data.byWikiProject,
      topArticles: data.topArticles,
    };

    return JSON.stringify(report, null, 2);
  }
}
