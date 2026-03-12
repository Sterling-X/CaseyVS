import { subMonths } from "date-fns";
import { KeywordType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { monthId, monthStart, normalizeText } from "@/lib/utils";

export type DashboardFilters = {
  marketId?: string;
  keywordType?: KeywordType;
  intentGroupId?: string;
  competitorId?: string;
  primaryTargetOnly?: boolean;
  activeOnly?: boolean;
};

type RankingRow = {
  keywordId: string | null;
  keywordText: string;
  domain: string;
  normalizedDomain: string;
  rank: number | null;
  rankingType: string | null;
  landingUrl: string | null;
  capturedAt: Date;
  reportingMonth: Date;
  keywordType: KeywordType | null;
  intentGroup: string;
  market: string;
  isPrimaryTarget: boolean;
  tags: string | null;
  intents: string | null;
  searchVolume: number | null;
  cpc: number | null;
  keywordDifficulty: number | null;
};

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function average(values: Array<number | null | undefined>) {
  const nums = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  if (nums.length === 0) {
    return null;
  }
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function rankToVisibilityProxy(rank: number | null) {
  if (!rank || rank <= 0) {
    return 0;
  }

  if (rank === 1) return 100;
  if (rank === 2) return 80;
  if (rank === 3) return 65;
  if (rank <= 10) return Math.max(23, 65 - (rank - 3) * 6);
  if (rank <= 20) return Math.max(5, 20 - (rank - 10) * 1.5);
  if (rank <= 50) return Math.max(1, 5 - (rank - 20) * 0.12);
  return 0.2;
}

function normalizeRankingType(value: string | null, keywordType: KeywordType | null) {
  const text = normalizeText(value ?? "");
  if (text.includes("local")) {
    return "local";
  }
  if (text.includes("organic")) {
    return "organic";
  }
  if (keywordType === KeywordType.LOCAL) {
    return "local";
  }
  return "organic";
}

function rankingBucket(rank: number | null) {
  if (rank === null) return "not ranking";
  if (rank <= 3) return "1-3";
  if (rank <= 10) return "4-10";
  if (rank <= 20) return "11-20";
  if (rank <= 50) return "21-50";
  return "51+";
}

function makeBucketCounts(rows: RankingRow[]) {
  const buckets = {
    "1-3": 0,
    "4-10": 0,
    "11-20": 0,
    "21-50": 0,
    "51+": 0,
    "not ranking": 0,
  };

  for (const row of rows) {
    buckets[rankingBucket(row.rank)] += 1;
  }

  return Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));
}

function latestSnapshot(rows: RankingRow[]) {
  const latest = new Map<string, RankingRow>();

  for (const row of rows) {
    const key = `${row.keywordId ?? normalizeText(row.keywordText)}|${row.normalizedDomain}|${normalizeRankingType(row.rankingType, row.keywordType)}`;
    const existing = latest.get(key);
    if (!existing || existing.capturedAt < row.capturedAt) {
      latest.set(key, row);
    }
  }

  return [...latest.values()];
}

function buildMonthSeries(month: Date, count = 6) {
  const list: Date[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    list.push(monthStart(subMonths(month, index)));
  }
  return list;
}

function asCurrent(value: number | null | undefined, fallback: number | null | undefined) {
  if (value !== null && value !== undefined) {
    return value;
  }
  return fallback ?? 0;
}

function aggregateQueryMetrics(
  rows: Array<{
    clicks: number;
    impressions: number;
    ctr: number | null;
    averagePosition: number | null;
    currentClicks: number;
    previousClicks: number;
    currentImpressions: number;
    previousImpressions: number;
    currentCtr: number | null;
    previousCtr: number | null;
    currentPosition: number | null;
    previousPosition: number | null;
    isBrandExcluded: boolean;
    isPageExcluded: boolean;
  }>,
  predicate?: (row: { isBrandExcluded: boolean; isPageExcluded: boolean }) => boolean,
) {
  const scoped = predicate ? rows.filter(predicate) : rows;

  let currentClicks = 0;
  let previousClicks = 0;
  let currentImpressions = 0;
  let previousImpressions = 0;
  let currentWeightedPos = 0;
  let previousWeightedPos = 0;

  for (const row of scoped) {
    const rowCurrentClicks = asCurrent(row.currentClicks, row.clicks);
    const rowCurrentImpressions = asCurrent(row.currentImpressions, row.impressions);
    const rowCurrentCtr = row.currentCtr ?? row.ctr;
    const rowCurrentPos = row.currentPosition ?? row.averagePosition;

    currentClicks += rowCurrentClicks;
    previousClicks += row.previousClicks ?? 0;
    currentImpressions += rowCurrentImpressions;
    previousImpressions += row.previousImpressions ?? 0;
    currentWeightedPos += (rowCurrentPos ?? 0) * rowCurrentImpressions;
    previousWeightedPos += (row.previousPosition ?? 0) * (row.previousImpressions ?? 0);

    if (rowCurrentCtr === null && rowCurrentImpressions > 0) {
      // no-op, CTR is derived at aggregate level
    }
  }

  return {
    currentClicks,
    previousClicks,
    currentImpressions,
    previousImpressions,
    currentCtr: currentImpressions > 0 ? currentClicks / currentImpressions : 0,
    previousCtr: previousImpressions > 0 ? previousClicks / previousImpressions : 0,
    currentPosition: currentImpressions > 0 ? currentWeightedPos / currentImpressions : 0,
    previousPosition: previousImpressions > 0 ? previousWeightedPos / previousImpressions : 0,
  };
}

export async function getDashboardPayload(projectId: string, reportingMonthInput: Date, filters: DashboardFilters) {
  const reportingMonth = monthStart(reportingMonthInput);
  const previousMonth = monthStart(subMonths(reportingMonth, 1));
  const trendMonths = buildMonthSeries(reportingMonth, 6);

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      markets: { where: { isActive: true }, orderBy: { name: "asc" } },
      intentGroups: { where: { isActive: true }, orderBy: { name: "asc" } },
      competitors: { where: { isActive: true }, orderBy: [{ isPrimary: "desc" }, { domain: "asc" }] },
    },
  });

  const keywordWhere = {
    projectId,
    ...(filters.activeOnly === false ? {} : { isActive: true }),
    ...(filters.keywordType ? { keywordType: filters.keywordType } : {}),
    ...(filters.marketId ? { marketId: filters.marketId } : {}),
    ...(filters.intentGroupId ? { intentGroupId: filters.intentGroupId } : {}),
    ...(filters.primaryTargetOnly ? { isPrimaryTarget: true } : {}),
  };

  const [totalKeywordCount, keywords] = await Promise.all([
    prisma.keyword.count({ where: { projectId } }),
    prisma.keyword.findMany({
      where: keywordWhere,
      include: {
        market: true,
        intentGroup: true,
      },
      orderBy: [{ text: "asc" }],
    }),
  ]);

  const keywordIds = keywords.map((keyword) => keyword.id);
  const useKeywordFiltering = totalKeywordCount > 0;
  const keywordFilter = useKeywordFiltering
    ? { keywordId: { in: keywordIds.length > 0 ? keywordIds : ["__none__"] } }
    : {};

  const selectedCompetitorDomain = filters.competitorId
    ? project.competitors.find((item) => item.id === filters.competitorId)?.normalizedDomain
    : undefined;

  const rankingRowsRaw = await prisma.semrushRankingRecord.findMany({
    where: {
      projectId,
      reportingMonth,
      ...keywordFilter,
      ...(filters.marketId ? { marketId: filters.marketId } : {}),
      ...(selectedCompetitorDomain ? { normalizedDomain: selectedCompetitorDomain } : {}),
    },
    include: {
      keyword: { include: { market: true, intentGroup: true } },
      market: true,
    },
  });

  const previousRankingRowsRaw = await prisma.semrushRankingRecord.findMany({
    where: {
      projectId,
      reportingMonth: previousMonth,
      ...keywordFilter,
      ...(filters.marketId ? { marketId: filters.marketId } : {}),
      ...(selectedCompetitorDomain ? { normalizedDomain: selectedCompetitorDomain } : {}),
    },
    include: {
      keyword: { include: { market: true, intentGroup: true } },
      market: true,
    },
  });

  const trendRankingRowsRaw = await prisma.semrushRankingRecord.findMany({
    where: {
      projectId,
      reportingMonth: { in: trendMonths },
      ...keywordFilter,
      ...(filters.marketId ? { marketId: filters.marketId } : {}),
    },
    include: {
      keyword: true,
    },
  });

  const toRankingRow = (row: (typeof rankingRowsRaw)[number]): RankingRow => ({
    keywordId: row.keywordId,
    keywordText: row.keywordText,
    domain: row.domain,
    normalizedDomain: row.normalizedDomain,
    rank: row.rank,
    rankingType: row.rankingType,
    landingUrl: row.landingUrl,
    capturedAt: row.capturedAt,
    reportingMonth: row.reportingMonth,
    keywordType: row.keyword?.keywordType ?? null,
    intentGroup: row.keyword?.intentGroup?.name ?? "Uncategorized",
    market: row.keyword?.market?.name ?? row.market?.name ?? "-",
    isPrimaryTarget: row.keyword?.isPrimaryTarget ?? false,
    tags: row.tags,
    intents: row.intents,
    searchVolume: row.searchVolume,
    cpc: row.cpc,
    keywordDifficulty: row.keywordDifficulty,
  });

  const rankingRows = rankingRowsRaw.map(toRankingRow);
  const previousRankingRows = previousRankingRowsRaw.map(toRankingRow);
  const trendRankingRows = trendRankingRowsRaw.map((row) => ({
    ...row,
    keywordType: row.keyword?.keywordType ?? null,
  }));

  const snapshotCurrent = latestSnapshot(rankingRows);
  const snapshotPrevious = latestSnapshot(previousRankingRows);

  const ownCurrent = snapshotCurrent.filter((row) => row.normalizedDomain === project.normalizedDomain);
  const ownPrevious = snapshotPrevious.filter((row) => row.normalizedDomain === project.normalizedDomain);

  const ownCurrentLocal = ownCurrent.filter((row) => normalizeRankingType(row.rankingType, row.keywordType) === "local");
  const ownCurrentOrganic = ownCurrent.filter((row) => normalizeRankingType(row.rankingType, row.keywordType) === "organic");

  const totalTrackedKeywords = keywordIds.length > 0
    ? keywordIds.length
    : new Set(ownCurrent.map((row) => normalizeText(row.keywordText))).size;

  const top3Count = ownCurrent.filter((row) => row.rank !== null && row.rank <= 3).length;
  const top10Count = ownCurrent.filter((row) => row.rank !== null && row.rank <= 10).length;

  const gscRows = await prisma.gSCQueryRecord.findMany({
    where: {
      projectId,
      reportingMonth,
    },
    orderBy: [{ currentClicks: "desc" }, { clicks: "desc" }],
  });

  const trendGscRows = await prisma.gSCQueryRecord.findMany({
    where: {
      projectId,
      reportingMonth: { in: trendMonths },
    },
  });

  const gscPageRows = await prisma.gSCPageRecord.findMany({
    where: { projectId, reportingMonth },
    orderBy: { currentClicks: "desc" },
    take: 15,
  });

  const gscCountryRows = await prisma.gSCCountryRecord.findMany({
    where: { projectId, reportingMonth },
    orderBy: { currentClicks: "desc" },
    take: 10,
  });

  const gscDeviceRows = await prisma.gSCDeviceRecord.findMany({
    where: { projectId, reportingMonth },
    orderBy: { currentClicks: "desc" },
    take: 10,
  });

  const gscAppearanceRows = await prisma.gSCSearchAppearanceRecord.findMany({
    where: { projectId, reportingMonth },
    orderBy: { currentClicks: "desc" },
    take: 10,
  });

  const currentTotal = aggregateQueryMetrics(gscRows);
  const currentNonBrand = aggregateQueryMetrics(gscRows, (row) => !row.isBrandExcluded);
  const currentNonBrandNonPage = aggregateQueryMetrics(gscRows, (row) => !row.isBrandExcluded && !row.isPageExcluded);

  const rankingDistribution = {
    overall: makeBucketCounts(ownCurrent),
    local: makeBucketCounts(ownCurrentLocal),
    organic: makeBucketCounts(ownCurrentOrganic),
  };

  const competitorGroups = new Map<string, RankingRow[]>();
  for (const row of snapshotCurrent) {
    const list = competitorGroups.get(row.normalizedDomain) ?? [];
    list.push(row);
    competitorGroups.set(row.normalizedDomain, list);
  }

  const competitorRows = [...competitorGroups.entries()].map(([domain, rows]) => {
    const rankedRows = rows.filter((item) => item.rank !== null);
    return {
      domain,
      averageRank: average(rankedRows.map((item) => item.rank)),
      visibilityProxy: average(rows.map((item) => rankToVisibilityProxy(item.rank))) ?? 0,
      coverage: rankedRows.length,
    };
  }).sort((a, b) => b.visibilityProxy - a.visibilityProxy);

  const myDomainSummary = competitorRows.find((row) => row.domain === project.normalizedDomain) ?? null;
  const otherCompetitors = competitorRows.filter((row) => row.domain !== project.normalizedDomain);

  const dateList = [...new Set(rankingRows.map((row) => dateKey(row.capturedAt)))].sort();
  const latestDate = dateList[dateList.length - 1] ?? null;
  const previousDate = dateList.length > 1 ? dateList[dateList.length - 2] : null;

  const semrushDomains = Array.from(
    new Set([
      project.normalizedDomain,
      ...competitorRows.map((row) => row.domain),
    ]),
  ).slice(0, 6);

  const dailyAccumulator = new Map<string, Map<string, number[]>>();
  for (const row of rankingRows) {
    if (!semrushDomains.includes(row.normalizedDomain)) {
      continue;
    }
    const day = dateKey(row.capturedAt);
    const byDomain = dailyAccumulator.get(day) ?? new Map<string, number[]>();
    const values = byDomain.get(row.normalizedDomain) ?? [];
    values.push(rankToVisibilityProxy(row.rank));
    byDomain.set(row.normalizedDomain, values);
    dailyAccumulator.set(day, byDomain);
  }

  const semrushDailyTrend = [...dailyAccumulator.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, byDomain]) => {
      const record: Record<string, string | number | null> = { date: day };
      semrushDomains.forEach((domain) => {
        record[domain] = average(byDomain.get(domain) ?? []) ?? null;
      });
      return record;
    });

  const latestRows = latestDate ? rankingRows.filter((row) => dateKey(row.capturedAt) === latestDate) : [];
  const previousRows = previousDate ? rankingRows.filter((row) => dateKey(row.capturedAt) === previousDate) : [];

  const latestByKey = new Map<string, RankingRow>();
  for (const row of latestRows) {
    const key = `${row.keywordId ?? normalizeText(row.keywordText)}|${normalizeRankingType(row.rankingType, row.keywordType)}|${row.normalizedDomain}`;
    latestByKey.set(key, row);
  }

  const previousByKey = new Map<string, RankingRow>();
  for (const row of previousRows) {
    const key = `${row.keywordId ?? normalizeText(row.keywordText)}|${normalizeRankingType(row.rankingType, row.keywordType)}|${row.normalizedDomain}`;
    previousByKey.set(key, row);
  }

  const matrixGroups = new Map<
    string,
    {
      key: string;
      keyword: string;
      type: string;
      tags: string | null;
      intents: string | null;
      searchVolume: number | null;
      cpc: number | null;
      keywordDifficulty: number | null;
      landingUrl: string | null;
      domainRanks: Record<string, { rank: number | null; movement: number | null }>;
    }
  >();

  for (const row of latestRows) {
    const keywordKey = `${row.keywordId ?? normalizeText(row.keywordText)}|${normalizeRankingType(row.rankingType, row.keywordType)}`;
    const existing = matrixGroups.get(keywordKey) ?? {
      key: keywordKey,
      keyword: row.keywordText,
      type: normalizeRankingType(row.rankingType, row.keywordType),
      tags: row.tags,
      intents: row.intents,
      searchVolume: row.searchVolume,
      cpc: row.cpc,
      keywordDifficulty: row.keywordDifficulty,
      landingUrl: row.normalizedDomain === project.normalizedDomain ? row.landingUrl : null,
      domainRanks: {},
    };

    const key = `${row.keywordId ?? normalizeText(row.keywordText)}|${normalizeRankingType(row.rankingType, row.keywordType)}|${row.normalizedDomain}`;
    const previous = previousByKey.get(key)?.rank ?? null;
    const movement = row.rank !== null && previous !== null ? previous - row.rank : null;
    existing.domainRanks[row.normalizedDomain] = {
      rank: row.rank,
      movement,
    };

    if (!existing.landingUrl && row.normalizedDomain === project.normalizedDomain) {
      existing.landingUrl = row.landingUrl;
    }
    if (!existing.tags && row.tags) {
      existing.tags = row.tags;
    }
    if (!existing.intents && row.intents) {
      existing.intents = row.intents;
    }

    matrixGroups.set(keywordKey, existing);
  }

  const semrushKeywordMatrix = [...matrixGroups.values()]
    .sort((a, b) => {
      const aRank = a.domainRanks[project.normalizedDomain]?.rank;
      const bRank = b.domainRanks[project.normalizedDomain]?.rank;
      if (aRank === null || aRank === undefined) return 1;
      if (bRank === null || bRank === undefined) return -1;
      return aRank - bRank;
    })
    .slice(0, 250);

  const currentOwnByKey = new Map<string, RankingRow>();
  for (const row of ownCurrent) {
    const key = `${row.keywordId ?? normalizeText(row.keywordText)}|${normalizeRankingType(row.rankingType, row.keywordType)}`;
    currentOwnByKey.set(key, row);
  }

  const previousOwnByKey = new Map<string, RankingRow>();
  for (const row of ownPrevious) {
    const key = `${row.keywordId ?? normalizeText(row.keywordText)}|${normalizeRankingType(row.rankingType, row.keywordType)}`;
    previousOwnByKey.set(key, row);
  }

  const movementRows: Array<{ keyword: string; type: string; previous: number | null; current: number | null; movement: number }> = [];
  const movementKeys = new Set([...currentOwnByKey.keys(), ...previousOwnByKey.keys()]);
  let gained = 0;
  let lost = 0;

  for (const key of movementKeys) {
    const current = currentOwnByKey.get(key);
    const previous = previousOwnByKey.get(key);
    const currentRank = current?.rank ?? null;
    const previousRank = previous?.rank ?? null;

    if (currentRank !== null && previousRank === null) {
      gained += 1;
      continue;
    }

    if (currentRank === null && previousRank !== null) {
      lost += 1;
      continue;
    }

    if (currentRank !== null && previousRank !== null) {
      movementRows.push({
        keyword: current?.keywordText ?? previous?.keywordText ?? key,
        type: current ? normalizeRankingType(current.rankingType, current.keywordType) : "organic",
        previous: previousRank,
        current: currentRank,
        movement: previousRank - currentRank,
      });
    }
  }

  const winners = movementRows.filter((row) => row.movement > 0).sort((a, b) => b.movement - a.movement).slice(0, 10);
  const losers = movementRows.filter((row) => row.movement < 0).sort((a, b) => a.movement - b.movement).slice(0, 10);

  const currentPages = new Map<string, { page: string; ranks: number[]; keywords: Set<string> }>();
  for (const row of ownCurrent) {
    if (!row.landingUrl) continue;
    const key = row.landingUrl;
    const page = currentPages.get(key) ?? { page: row.landingUrl, ranks: [], keywords: new Set<string>() };
    if (row.rank !== null) {
      page.ranks.push(row.rank);
    }
    page.keywords.add(row.keywordText);
    currentPages.set(key, page);
  }

  const previousPages = new Map<string, number>();
  for (const row of ownPrevious) {
    if (!row.landingUrl || row.rank === null) continue;
    const prev = previousPages.get(row.landingUrl);
    if (prev === undefined) {
      previousPages.set(row.landingUrl, row.rank);
    } else {
      previousPages.set(row.landingUrl, (prev + row.rank) / 2);
    }
  }

  const pageRows = [...currentPages.values()].map((page) => ({
    page: page.page,
    keywordCoverage: page.keywords.size,
    averageRank: average(page.ranks),
    movement: (() => {
      const prev = previousPages.get(page.page);
      const current = average(page.ranks);
      if (prev === undefined || current === null) return null;
      return prev - current;
    })(),
  }));

  const topLandingPages = [...pageRows]
    .sort((a, b) => b.keywordCoverage - a.keywordCoverage || (a.averageRank ?? 999) - (b.averageRank ?? 999))
    .slice(0, 12);

  const improvedPages = [...pageRows].filter((row) => (row.movement ?? 0) > 0).sort((a, b) => (b.movement ?? 0) - (a.movement ?? 0)).slice(0, 8);
  const declinedPages = [...pageRows].filter((row) => (row.movement ?? 0) < 0).sort((a, b) => (a.movement ?? 0) - (b.movement ?? 0)).slice(0, 8);

  const trend = trendMonths.map((month) => {
    const id = monthId(month);
    const monthRankingRows = trendRankingRows
      .filter((row) => monthId(row.reportingMonth) === id)
      .map((row) => ({
        keywordId: row.keywordId,
        keywordText: row.keywordText,
        domain: row.domain,
        normalizedDomain: row.normalizedDomain,
        rank: row.rank,
        rankingType: row.rankingType,
        landingUrl: row.landingUrl,
        capturedAt: row.capturedAt,
        reportingMonth: row.reportingMonth,
        keywordType: row.keywordType,
        intentGroup: "-",
        market: "-",
        isPrimaryTarget: false,
        tags: row.tags,
        intents: row.intents,
        searchVolume: row.searchVolume,
        cpc: row.cpc,
        keywordDifficulty: row.keywordDifficulty,
      }));

    const monthOwn = latestSnapshot(monthRankingRows).filter((row) => row.normalizedDomain === project.normalizedDomain);
    const monthOrganic = monthOwn.filter((row) => normalizeRankingType(row.rankingType, row.keywordType) === "organic");
    const monthLocal = monthOwn.filter((row) => normalizeRankingType(row.rankingType, row.keywordType) === "local");
    const monthGsc = trendGscRows.filter((row) => monthId(row.reportingMonth) === id);
    const monthGscNonBrand = aggregateQueryMetrics(monthGsc, (row) => !row.isBrandExcluded);

    return {
      month: id,
      averageRank: average(monthOwn.map((row) => row.rank)),
      averageOrganicRank: average(monthOrganic.map((row) => row.rank)),
      averageLocalRank: average(monthLocal.map((row) => row.rank)),
      visibilityProxy: average(monthOwn.map((row) => rankToVisibilityProxy(row.rank))),
      nonBrandClicks: monthGscNonBrand.currentClicks,
    };
  });

  const monthImportJobs = await prisma.importJob.findMany({
    where: {
      projectId,
      reportingMonth,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const monthIssues = await prisma.dataHealthIssue.findMany({
    where: {
      projectId,
      reportingMonth,
    },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: 40,
  });

  return {
    project: {
      id: project.id,
      name: project.name,
      domain: project.domain,
      markets: project.markets,
      intentGroups: project.intentGroups,
      competitors: project.competitors,
    },
    month: monthId(reportingMonth),
    filters,
    executive: {
      totalTrackedKeywords,
      top3Count,
      top10Count,
      averageRank: average(ownCurrent.map((row) => row.rank)),
      averageLocalRank: average(ownCurrentLocal.map((row) => row.rank)),
      averageOrganicRank: average(ownCurrentOrganic.map((row) => row.rank)),
      visibilityProxy: average(ownCurrent.map((row) => rankToVisibilityProxy(row.rank))),
      gsc: {
        totalClicks: currentTotal.currentClicks,
        nonBrandClicks: currentNonBrand.currentClicks,
        nonBrandNonPageClicks: currentNonBrandNonPage.currentClicks,
      },
    },
    semrushPanel: {
      latestDate,
      previousDate,
      domains: semrushDomains,
      summary: {
        totalKeywords: totalTrackedKeywords,
        rankedKeywords: ownCurrent.filter((row) => row.rank !== null).length,
        avgRank: average(ownCurrent.map((row) => row.rank)),
        avgLocalRank: average(ownCurrentLocal.map((row) => row.rank)),
        avgOrganicRank: average(ownCurrentOrganic.map((row) => row.rank)),
        visibilityProxy: average(ownCurrent.map((row) => rankToVisibilityProxy(row.rank))),
        top3Count,
        top10Count,
      },
      dailyTrend: semrushDailyTrend,
      keywordMatrix: semrushKeywordMatrix,
    },
    rankingDistribution,
    competitorSummary: {
      myDomain: project.normalizedDomain,
      myDomainAverageRank: myDomainSummary?.averageRank ?? null,
      competitorAverageRank: average(otherCompetitors.map((item) => item.averageRank)),
      rows: competitorRows,
    },
    movementSummary: {
      winners,
      losers,
      gained,
      lost,
    },
    landingPageSummary: {
      topPages: topLandingPages,
      improvedPages,
      declinedPages,
    },
    gscSummary: {
      total: currentTotal,
      nonBrand: currentNonBrand,
      nonBrandNonPage: currentNonBrandNonPage,
      topIncludedQueries: gscRows
        .filter((row) => !row.isBrandExcluded && !row.isPageExcluded)
        .slice(0, 20)
        .map((row) => ({
          query: row.query,
          currentClicks: asCurrent(row.currentClicks, row.clicks),
          previousClicks: row.previousClicks,
          currentImpressions: asCurrent(row.currentImpressions, row.impressions),
          previousImpressions: row.previousImpressions,
          currentCtr: row.currentCtr ?? row.ctr,
          previousCtr: row.previousCtr,
          currentPosition: row.currentPosition ?? row.averagePosition,
          previousPosition: row.previousPosition,
        })),
      topExcludedQueries: gscRows
        .filter((row) => row.isBrandExcluded || row.isPageExcluded)
        .slice(0, 20)
        .map((row) => ({
          query: row.query,
          currentClicks: asCurrent(row.currentClicks, row.clicks),
          previousClicks: row.previousClicks,
          reason: row.exclusionReasonText || "excluded",
        })),
      topPages: gscPageRows,
      devices: gscDeviceRows,
      countries: gscCountryRows,
      appearances: gscAppearanceRows,
    },
    trend,
    dataQuality: {
      importStatus: monthImportJobs.map((job) => ({
        id: job.id,
        sourceType: job.sourceType,
        status: job.status,
        rowCount: job.rowCount,
        errorCount: job.errorCount,
        warningCount: job.warningCount,
        createdAt: job.createdAt,
      })),
      parsingIssues: monthImportJobs.reduce((sum, job) => sum + job.errorCount + job.warningCount, 0),
      warnings: monthIssues.filter((issue) => issue.severity === "WARNING").length,
      qaOpen: monthIssues.filter((issue) => issue.status === "OPEN").length,
      suspiciousRows: monthIssues.filter((issue) => issue.severity === "ERROR").length,
      issues: monthIssues,
    },
  };
}
