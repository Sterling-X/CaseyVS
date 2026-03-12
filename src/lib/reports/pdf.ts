import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { getDashboardPayload } from "@/lib/dashboard/service";
import { formatNumber, formatPct, formatRank } from "@/lib/utils";

export type DashboardPdfPayload = Awaited<ReturnType<typeof getDashboardPayload>>;

function asNum(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return value.toFixed(digits);
}

export async function buildDashboardPdf(payload: DashboardPdfPayload) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait points
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();

  const draw = (text: string, x: number, yTop: number, opts?: { bold?: boolean; size?: number; color?: [number, number, number] }) => {
    const size = opts?.size ?? 9;
    const color = opts?.color ?? [0.06, 0.11, 0.20];
    const y = height - yTop - size;
    page.drawText(text, {
      x,
      y,
      size,
      font: opts?.bold ? fontBold : font,
      color: rgb(color[0], color[1], color[2]),
      maxWidth: 520,
    });
  };

  let y = 36;
  const leftX = 36;
  const rightX = 306;

  draw("Executive SEO Performance Dashboard", leftX, y, { bold: true, size: 16, color: [0.07, 0.09, 0.13] });
  y += 22;
  draw(`${payload.project.name} (${payload.project.domain})`, leftX, y, { size: 10, color: [0.2, 0.25, 0.32] });
  y += 14;
  draw(`Reporting month: ${payload.month}`, leftX, y, { size: 10, color: [0.2, 0.25, 0.32] });
  draw(`Generated: ${new Date().toISOString().slice(0, 19)} UTC`, rightX, y, { size: 9, color: [0.39, 0.45, 0.53] });

  y += 18;
  page.drawLine({ start: { x: 36, y: height - y }, end: { x: 559, y: height - y }, thickness: 1, color: rgb(0.89, 0.91, 0.94) });
  y += 10;

  draw("Top KPI Summary", leftX, y, { bold: true, size: 11 });
  y += 14;
  draw(`Tracked keywords: ${formatNumber(payload.executive.totalTrackedKeywords)}`, leftX, y);
  draw(`Top 3: ${formatNumber(payload.executive.top3Count)}`, rightX, y);
  y += 12;
  draw(`Top 10: ${formatNumber(payload.executive.top10Count)}`, leftX, y);
  draw(`Avg rank: ${formatRank(payload.executive.averageRank)}`, rightX, y);
  y += 12;
  draw(`Avg local rank: ${formatRank(payload.executive.averageLocalRank)}`, leftX, y);
  draw(`Avg organic rank: ${formatRank(payload.executive.averageOrganicRank)}`, rightX, y);
  y += 12;
  draw(`Visibility proxy (derived): ${asNum(payload.executive.visibilityProxy, 1)}`, leftX, y);
  draw(`GSC clicks: ${formatNumber(payload.executive.gsc.totalClicks)}`, rightX, y);
  y += 12;
  draw(`Non-brand clicks: ${formatNumber(payload.executive.gsc.nonBrandClicks)}`, leftX, y);
  draw(`Non-brand + non-page clicks: ${formatNumber(payload.executive.gsc.nonBrandNonPageClicks)}`, rightX, y);

  y += 16;
  draw("Ranking Distribution", leftX, y, { bold: true, size: 11 });
  draw("Competitor Summary", rightX, y, { bold: true, size: 11 });
  y += 12;

  payload.rankingDistribution.overall.slice(0, 6).forEach((item, idx) => {
    draw(`${item.bucket}: ${item.count}`, leftX, y + idx * 10);
  });

  draw(`My avg rank: ${formatRank(payload.competitorSummary.myDomainAverageRank)}`, rightX, y);
  draw(`Competitor avg rank: ${formatRank(payload.competitorSummary.competitorAverageRank)}`, rightX, y + 10);
  payload.competitorSummary.rows.slice(0, 4).forEach((row, idx) => {
    draw(`${row.domain} | rank ${formatRank(row.averageRank)} | proxy ${row.visibilityProxy.toFixed(1)}`, rightX, y + 20 + idx * 10);
  });

  y += 64;
  draw("Keyword Movement", leftX, y, { bold: true, size: 11 });
  y += 12;
  draw(`Rankings gained: ${payload.movementSummary.gained}`, leftX, y);
  draw(`Rankings lost: ${payload.movementSummary.lost}`, rightX, y);
  y += 10;
  payload.movementSummary.winners.slice(0, 3).forEach((row, idx) => {
    draw(`Winner: ${row.keyword} (+${row.movement})`, leftX, y + idx * 10);
  });
  payload.movementSummary.losers.slice(0, 3).forEach((row, idx) => {
    draw(`Loser: ${row.keyword} (${row.movement})`, rightX, y + idx * 10);
  });

  y += 44;
  draw("Landing Page Coverage", leftX, y, { bold: true, size: 11 });
  y += 12;
  payload.landingPageSummary.topPages.slice(0, 4).forEach((row, idx) => {
    draw(`${row.page.slice(0, 48)} | keywords ${row.keywordCoverage} | rank ${formatRank(row.averageRank)}`, leftX, y + idx * 10);
  });

  y += 50;
  draw("GSC Summary", leftX, y, { bold: true, size: 11 });
  y += 12;
  draw(
    `Clicks ${formatNumber(payload.gscSummary.total.currentClicks)} vs ${formatNumber(payload.gscSummary.total.previousClicks)} | Impr ${formatNumber(payload.gscSummary.total.currentImpressions)} vs ${formatNumber(payload.gscSummary.total.previousImpressions)}`,
    leftX,
    y,
  );
  y += 10;
  draw(
    `CTR ${formatPct(payload.gscSummary.total.currentCtr)} vs ${formatPct(payload.gscSummary.total.previousCtr)} | Position ${formatRank(payload.gscSummary.total.currentPosition)} vs ${formatRank(payload.gscSummary.total.previousPosition)}`,
    leftX,
    y,
  );
  y += 10;
  draw(
    `Non-brand clicks ${formatNumber(payload.gscSummary.nonBrand.currentClicks)} | Non-brand+non-page clicks ${formatNumber(payload.gscSummary.nonBrandNonPage.currentClicks)}`,
    leftX,
    y,
  );

  y += 14;
  draw("Top Included Queries", leftX, y, { bold: true, size: 10 });
  draw("Top Excluded Queries", rightX, y, { bold: true, size: 10 });
  y += 10;
  payload.gscSummary.topIncludedQueries.slice(0, 3).forEach((row, idx) => {
    draw(`${row.query} | ${row.currentClicks} clicks`, leftX, y + idx * 10);
  });
  payload.gscSummary.topExcludedQueries.slice(0, 3).forEach((row, idx) => {
    draw(`${row.query} | ${row.reason}`, rightX, y + idx * 10);
  });

  y += 40;
  draw("Data Quality", leftX, y, { bold: true, size: 11 });
  y += 12;
  draw(
    `Parsing issues ${payload.dataQuality.parsingIssues} | Warnings ${payload.dataQuality.warnings} | Suspicious rows ${payload.dataQuality.suspiciousRows} | Open QA ${payload.dataQuality.qaOpen}`,
    leftX,
    y,
  );
  y += 10;
  payload.dataQuality.importStatus.slice(0, 4).forEach((row, idx) => {
    draw(`${row.sourceType}: ${row.status} (rows ${row.rowCount}, errors ${row.errorCount}, warnings ${row.warningCount})`, leftX, y + idx * 10);
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
