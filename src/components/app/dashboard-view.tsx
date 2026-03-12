"use client";

import { useEffect, useMemo, useState } from "react";
import { KeywordType } from "@prisma/client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatPct, formatRank } from "@/lib/utils";

type DashboardPayload = {
  project: {
    markets: Array<{ id: string; name: string }>;
    intentGroups: Array<{ id: string; name: string }>;
    competitors: Array<{ id: string; domain: string }>;
  };
  executive: {
    totalTrackedKeywords: number;
    top3Count: number;
    top10Count: number;
    averageRank: number | null;
    averageLocalRank: number | null;
    averageOrganicRank: number | null;
    visibilityProxy: number | null;
    gsc: {
      totalClicks: number;
      nonBrandClicks: number;
      nonBrandNonPageClicks: number;
    };
  };
  semrushPanel: {
    latestDate: string | null;
    previousDate: string | null;
    domains: string[];
    summary: {
      totalKeywords: number;
      rankedKeywords: number;
      avgRank: number | null;
      avgLocalRank: number | null;
      avgOrganicRank: number | null;
      visibilityProxy: number | null;
      top3Count: number;
      top10Count: number;
    };
    dailyTrend: Array<Record<string, string | number | null>>;
    keywordMatrix: Array<{
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
    }>;
  };
  rankingDistribution: {
    overall: Array<{ bucket: string; count: number }>;
    local: Array<{ bucket: string; count: number }>;
    organic: Array<{ bucket: string; count: number }>;
  };
  competitorSummary: {
    myDomainAverageRank: number | null;
    competitorAverageRank: number | null;
    rows: Array<{ domain: string; averageRank: number | null; visibilityProxy: number; coverage: number }>;
  };
  movementSummary: {
    winners: Array<{ keyword: string; movement: number; previous: number | null; current: number | null; type: string }>;
    losers: Array<{ keyword: string; movement: number; previous: number | null; current: number | null; type: string }>;
    gained: number;
    lost: number;
  };
  landingPageSummary: {
    topPages: Array<{ page: string; keywordCoverage: number; averageRank: number | null; movement: number | null }>;
    improvedPages: Array<{ page: string; keywordCoverage: number; averageRank: number | null; movement: number | null }>;
    declinedPages: Array<{ page: string; keywordCoverage: number; averageRank: number | null; movement: number | null }>;
  };
  gscSummary: {
    total: {
      currentClicks: number;
      previousClicks: number;
      currentImpressions: number;
      previousImpressions: number;
      currentCtr: number;
      previousCtr: number;
      currentPosition: number;
      previousPosition: number;
    };
    nonBrand: {
      currentClicks: number;
      previousClicks: number;
      currentImpressions: number;
      previousImpressions: number;
      currentCtr: number;
      previousCtr: number;
      currentPosition: number;
      previousPosition: number;
    };
    nonBrandNonPage: {
      currentClicks: number;
      previousClicks: number;
      currentImpressions: number;
      previousImpressions: number;
      currentCtr: number;
      previousCtr: number;
      currentPosition: number;
      previousPosition: number;
    };
    topIncludedQueries: Array<{
      query: string;
      currentClicks: number;
      previousClicks: number;
      currentImpressions: number;
      previousImpressions: number;
      currentCtr: number | null;
      previousCtr: number | null;
      currentPosition: number | null;
      previousPosition: number | null;
    }>;
    topExcludedQueries: Array<{ query: string; currentClicks: number; previousClicks: number; reason: string }>;
    topPages: Array<{ page: string; currentClicks: number; previousClicks: number }>;
    devices: Array<{ device: string; currentClicks: number; previousClicks: number }>;
    countries: Array<{ country: string; currentClicks: number; previousClicks: number }>;
    appearances: Array<{ appearance: string; currentClicks: number; previousClicks: number }>;
  };
  trend: Array<{
    month: string;
    averageRank: number | null;
    averageOrganicRank: number | null;
    averageLocalRank: number | null;
    visibilityProxy: number | null;
    nonBrandClicks: number;
  }>;
  dataQuality: {
    importStatus: Array<{ id: string; sourceType: string; status: string; rowCount: number; errorCount: number; warningCount: number }>;
    parsingIssues: number;
    warnings: number;
    qaOpen: number;
    suspiciousRows: number;
    issues: Array<{ id: string; severity: string; title: string; details: string; status: string }>;
  };
};

export function DashboardView({ projectId, reportingMonth }: { projectId: string; reportingMonth: string }) {
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [marketId, setMarketId] = useState("all");
  const [intentGroupId, setIntentGroupId] = useState("all");
  const [keywordType, setKeywordType] = useState<"all" | KeywordType>("all");
  const [competitorId, setCompetitorId] = useState("all");
  const [primaryTargetOnly, setPrimaryTargetOnly] = useState(false);
  const [activeOnly, setActiveOnly] = useState(true);

  const queryString = useMemo(() => {
    const query = new URLSearchParams();
    query.set("projectId", projectId);
    query.set("reportingMonth", reportingMonth);
    if (marketId !== "all") query.set("marketId", marketId);
    if (intentGroupId !== "all") query.set("intentGroupId", intentGroupId);
    if (keywordType !== "all") query.set("keywordType", keywordType);
    if (competitorId !== "all") query.set("competitorId", competitorId);
    query.set("primaryTargetOnly", String(primaryTargetOnly));
    query.set("activeOnly", String(activeOnly));
    return query.toString();
  }, [projectId, reportingMonth, marketId, intentGroupId, keywordType, competitorId, primaryTargetOnly, activeOnly]);

  async function refresh() {
    setLoading(true);
    const response = await fetch(`/api/dashboard?${queryString}`);
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Failed to load dashboard");
      setLoading(false);
      return;
    }

    setPayload(data);
    setMessage("");
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, [queryString]);

  if (!payload) {
    return <p className="text-sm text-stone-600">{loading ? "Loading dashboard..." : "No dashboard data yet."}</p>;
  }

  const kpis = [
    { label: "Tracked Keywords", value: formatNumber(payload.executive.totalTrackedKeywords) },
    { label: "Top 3", value: formatNumber(payload.executive.top3Count) },
    { label: "Top 10", value: formatNumber(payload.executive.top10Count) },
    { label: "Avg Rank", value: formatRank(payload.executive.averageRank) },
    { label: "Avg Local Rank", value: formatRank(payload.executive.averageLocalRank) },
    { label: "Avg Organic Rank", value: formatRank(payload.executive.averageOrganicRank) },
    { label: "Visibility Proxy", value: payload.executive.visibilityProxy !== null ? payload.executive.visibilityProxy.toFixed(1) : "-" },
    { label: "GSC Clicks", value: formatNumber(payload.executive.gsc.totalClicks) },
    { label: "Non-Brand Clicks", value: formatNumber(payload.executive.gsc.nonBrandClicks) },
    { label: "Non-Brand + Non-Page Clicks", value: formatNumber(payload.executive.gsc.nonBrandNonPageClicks) },
  ];

  const distributionData = payload.rankingDistribution.overall.map((row) => ({
    bucket: row.bucket,
    overall: row.count,
    local: payload.rankingDistribution.local.find((item) => item.bucket === row.bucket)?.count ?? 0,
    organic: payload.rankingDistribution.organic.find((item) => item.bucket === row.bucket)?.count ?? 0,
  }));

  const semrushLineColors = ["#2563eb", "#16a34a", "#9333ea", "#0d9488", "#b45309", "#dc2626"];

  return (
    <div className="space-y-5" id="executive-dashboard-page">
      <Card>
        <CardHeader>
          <CardTitle>Executive SEO Performance Dashboard</CardTitle>
          <CardDescription>Single-page monthly view for rankings, competitors, landing pages, GSC performance, and data quality.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Select value={marketId} onValueChange={setMarketId}>
            <SelectTrigger><SelectValue placeholder="Market" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Markets</SelectItem>
              {payload.project.markets.map((market) => (
                <SelectItem key={market.id} value={market.id}>{market.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={intentGroupId} onValueChange={setIntentGroupId}>
            <SelectTrigger><SelectValue placeholder="Intent Group" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Intent Groups</SelectItem>
              {payload.project.intentGroups.map((group) => (
                <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={keywordType} onValueChange={(value) => setKeywordType(value as "all" | KeywordType)}>
            <SelectTrigger><SelectValue placeholder="Keyword Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value={KeywordType.LOCAL}>LOCAL</SelectItem>
              <SelectItem value={KeywordType.CORE}>CORE</SelectItem>
              <SelectItem value={KeywordType.BRANDED}>BRANDED</SelectItem>
              <SelectItem value={KeywordType.OTHER}>OTHER</SelectItem>
            </SelectContent>
          </Select>

          <Select value={competitorId} onValueChange={setCompetitorId}>
            <SelectTrigger><SelectValue placeholder="Competitor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Competitors</SelectItem>
              {payload.project.competitors.map((competitor) => (
                <SelectItem key={competitor.id} value={competitor.id}>{competitor.domain}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="flex items-center gap-2 rounded-md border border-stone-200 px-3 py-2 text-sm">
            <Checkbox checked={primaryTargetOnly} onCheckedChange={(value) => setPrimaryTargetOnly(Boolean(value))} />
            Primary only
          </label>

          <label className="flex items-center gap-2 rounded-md border border-stone-200 px-3 py-2 text-sm">
            <Checkbox checked={activeOnly} onCheckedChange={(value) => setActiveOnly(Boolean(value))} />
            Active only
          </label>

          <Button onClick={refresh} disabled={loading}>{loading ? "Loading..." : "Refresh"}</Button>
          <Button variant="outline" asChild>
            <a href={`/api/reports/pdf?${queryString}`} target="_blank" rel="noreferrer">Export PDF</a>
          </Button>
        </CardContent>
      </Card>

      {message ? <p className="text-sm text-red-700">{message}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader>
              <CardDescription>{kpi.label}</CardDescription>
              <CardTitle className="text-2xl">{kpi.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="border-stone-300 bg-stone-50">
        <CardHeader>
          <CardTitle>Semrush Position Tracking Overview</CardTitle>
          <CardDescription>
            Snapshot date: {payload.semrushPanel.latestDate ?? "-"} {payload.semrushPanel.previousDate ? `| Previous: ${payload.semrushPanel.previousDate}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
            <div className="rounded-md border bg-white p-2 text-sm">
              <p className="text-xs text-stone-500">Tracked Keywords</p>
              <p className="font-semibold">{formatNumber(payload.semrushPanel.summary.totalKeywords)}</p>
            </div>
            <div className="rounded-md border bg-white p-2 text-sm">
              <p className="text-xs text-stone-500">Ranking Keywords</p>
              <p className="font-semibold">{formatNumber(payload.semrushPanel.summary.rankedKeywords)}</p>
            </div>
            <div className="rounded-md border bg-white p-2 text-sm">
              <p className="text-xs text-stone-500">Avg Rank</p>
              <p className="font-semibold">{formatRank(payload.semrushPanel.summary.avgRank)}</p>
            </div>
            <div className="rounded-md border bg-white p-2 text-sm">
              <p className="text-xs text-stone-500">Avg Local</p>
              <p className="font-semibold">{formatRank(payload.semrushPanel.summary.avgLocalRank)}</p>
            </div>
            <div className="rounded-md border bg-white p-2 text-sm">
              <p className="text-xs text-stone-500">Avg Organic</p>
              <p className="font-semibold">{formatRank(payload.semrushPanel.summary.avgOrganicRank)}</p>
            </div>
            <div className="rounded-md border bg-white p-2 text-sm">
              <p className="text-xs text-stone-500">Visibility Proxy</p>
              <p className="font-semibold">{payload.semrushPanel.summary.visibilityProxy?.toFixed(1) ?? "-"}</p>
            </div>
            <div className="rounded-md border bg-white p-2 text-sm">
              <p className="text-xs text-stone-500">Top 3</p>
              <p className="font-semibold">{formatNumber(payload.semrushPanel.summary.top3Count)}</p>
            </div>
            <div className="rounded-md border bg-white p-2 text-sm">
              <p className="text-xs text-stone-500">Top 10</p>
              <p className="font-semibold">{formatNumber(payload.semrushPanel.summary.top10Count)}</p>
            </div>
          </div>

          <div className="h-64 rounded-md border bg-white p-2">
            <ResponsiveContainer>
              <LineChart data={payload.semrushPanel.dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                {payload.semrushPanel.domains.map((domain, index) => (
                  <Line
                    key={domain}
                    type="monotone"
                    dataKey={domain}
                    stroke={semrushLineColors[index % semrushLineColors.length]}
                    dot={false}
                    strokeWidth={2}
                    name={domain}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-auto rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Keyword</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Intents</TableHead>
                  <TableHead>SV</TableHead>
                  <TableHead>KD</TableHead>
                  {payload.semrushPanel.domains.map((domain) => (
                    <TableHead key={domain}>{domain}</TableHead>
                  ))}
                  <TableHead className="min-w-[220px]">Landing URL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payload.semrushPanel.keywordMatrix.slice(0, 120).map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="font-medium">{row.keyword}</TableCell>
                    <TableCell className="uppercase">{row.type}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{row.tags ?? "-"}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{row.intents ?? "-"}</TableCell>
                    <TableCell>{row.searchVolume ?? "-"}</TableCell>
                    <TableCell>{row.keywordDifficulty?.toFixed(0) ?? "-"}</TableCell>
                    {payload.semrushPanel.domains.map((domain) => {
                      const rank = row.domainRanks[domain]?.rank ?? null;
                      const movement = row.domainRanks[domain]?.movement ?? null;
                      return (
                        <TableCell key={domain}>
                          <div className="flex items-center gap-1">
                            <span>{rank ?? "-"}</span>
                            {movement !== null ? (
                              <span className={movement > 0 ? "text-emerald-600" : movement < 0 ? "text-red-600" : "text-stone-500"}>
                                {movement > 0 ? `+${movement}` : movement}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                      );
                    })}
                    <TableCell className="max-w-[260px] truncate">{row.landingUrl ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ranking Distribution</CardTitle>
            <CardDescription>Overall plus local/organic split by ranking buckets.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={distributionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucket" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="overall" fill="#334155" name="Overall" />
                <Bar dataKey="local" fill="#0f766e" name="Local" />
                <Bar dataKey="organic" fill="#0369a1" name="Organic" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trend</CardTitle>
            <CardDescription>Average rank, visibility proxy, and non-brand clicks trend.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <LineChart data={payload.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="averageRank" stroke="#1d4ed8" name="Avg Rank" />
                <Line type="monotone" dataKey="visibilityProxy" stroke="#7c3aed" name="Visibility Proxy" />
                <Line type="monotone" dataKey="nonBrandClicks" stroke="#b45309" name="Non-Brand Clicks" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Competitor Summary</CardTitle>
          <CardDescription>
            My avg rank: {formatRank(payload.competitorSummary.myDomainAverageRank)} | Competitor avg rank: {formatRank(payload.competitorSummary.competitorAverageRank)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Avg Rank</TableHead>
                <TableHead>Visibility Proxy</TableHead>
                <TableHead>Keyword Coverage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payload.competitorSummary.rows.slice(0, 20).map((row) => (
                <TableRow key={row.domain}>
                  <TableCell>{row.domain}</TableCell>
                  <TableCell>{formatRank(row.averageRank)}</TableCell>
                  <TableCell>{row.visibilityProxy.toFixed(1)}</TableCell>
                  <TableCell>{formatNumber(row.coverage)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Keyword Movement</CardTitle>
            <CardDescription>
              Rankings gained: {payload.movementSummary.gained} | Rankings lost: {payload.movementSummary.lost}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="mb-2 text-sm font-semibold">Biggest Winners</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Prev</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead>Move</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payload.movementSummary.winners.slice(0, 8).map((row, idx) => (
                    <TableRow key={`winner-${idx}`}>
                      <TableCell>{row.keyword}</TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell>{row.previous ?? "-"}</TableCell>
                      <TableCell>{row.current ?? "-"}</TableCell>
                      <TableCell>+{row.movement}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold">Biggest Losers</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Prev</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead>Move</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payload.movementSummary.losers.slice(0, 8).map((row, idx) => (
                    <TableRow key={`loser-${idx}`}>
                      <TableCell>{row.keyword}</TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell>{row.previous ?? "-"}</TableCell>
                      <TableCell>{row.current ?? "-"}</TableCell>
                      <TableCell>{row.movement}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Landing Page Summary</CardTitle>
            <CardDescription>Top tracked landing pages and page-level movement.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead>Keyword Coverage</TableHead>
                  <TableHead>Avg Rank</TableHead>
                  <TableHead>Movement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payload.landingPageSummary.topPages.slice(0, 12).map((row) => (
                  <TableRow key={row.page}>
                    <TableCell className="max-w-[420px] truncate">{row.page}</TableCell>
                    <TableCell>{row.keywordCoverage}</TableCell>
                    <TableCell>{formatRank(row.averageRank)}</TableCell>
                    <TableCell>{row.movement === null ? "-" : row.movement.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>GSC Summary</CardTitle>
          <CardDescription>Total vs non-brand vs non-brand-and-non-page-specific performance.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Total Clicks: {formatNumber(payload.gscSummary.total.currentClicks)}</Badge>
            <Badge variant="secondary">Previous Clicks: {formatNumber(payload.gscSummary.total.previousClicks)}</Badge>
            <Badge variant="secondary">Non-Brand Clicks: {formatNumber(payload.gscSummary.nonBrand.currentClicks)}</Badge>
            <Badge variant="secondary">Non-Brand + Non-Page Clicks: {formatNumber(payload.gscSummary.nonBrandNonPage.currentClicks)}</Badge>
            <Badge variant="secondary">CTR: {formatPct(payload.gscSummary.total.currentCtr)}</Badge>
            <Badge variant="secondary">Position: {formatRank(payload.gscSummary.total.currentPosition)}</Badge>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-semibold">Top Included Queries</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Query</TableHead>
                    <TableHead>Current Clicks</TableHead>
                    <TableHead>Previous Clicks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payload.gscSummary.topIncludedQueries.slice(0, 12).map((row) => (
                    <TableRow key={row.query}>
                      <TableCell>{row.query}</TableCell>
                      <TableCell>{row.currentClicks}</TableCell>
                      <TableCell>{row.previousClicks}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold">Top Excluded Queries</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Query</TableHead>
                    <TableHead>Current Clicks</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payload.gscSummary.topExcludedQueries.slice(0, 12).map((row) => (
                    <TableRow key={row.query}>
                      <TableCell>{row.query}</TableCell>
                      <TableCell>{row.currentClicks}</TableCell>
                      <TableCell>{row.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div>
              <h4 className="mb-2 text-sm font-semibold">Top Pages</h4>
              <Table>
                <TableBody>
                  {payload.gscSummary.topPages.slice(0, 8).map((row) => (
                    <TableRow key={row.page}>
                      <TableCell className="max-w-[260px] truncate">{row.page}</TableCell>
                      <TableCell>{row.currentClicks}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold">Device Breakdown</h4>
              <Table>
                <TableBody>
                  {payload.gscSummary.devices.slice(0, 8).map((row) => (
                    <TableRow key={row.device}>
                      <TableCell>{row.device}</TableCell>
                      <TableCell>{row.currentClicks}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold">Country Breakdown</h4>
              <Table>
                <TableBody>
                  {payload.gscSummary.countries.slice(0, 8).map((row) => (
                    <TableRow key={row.country}>
                      <TableCell>{row.country}</TableCell>
                      <TableCell>{row.currentClicks}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Quality Summary</CardTitle>
          <CardDescription>Import health, parsing warnings, and open QA issues.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="warning">Parsing Issues: {payload.dataQuality.parsingIssues}</Badge>
            <Badge variant="warning">Warnings: {payload.dataQuality.warnings}</Badge>
            <Badge variant="error">Suspicious Rows: {payload.dataQuality.suspiciousRows}</Badge>
            <Badge variant="secondary">Open QA: {payload.dataQuality.qaOpen}</Badge>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rows</TableHead>
                <TableHead>Errors</TableHead>
                <TableHead>Warnings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payload.dataQuality.importStatus.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.sourceType}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>{row.rowCount}</TableCell>
                  <TableCell>{row.errorCount}</TableCell>
                  <TableCell>{row.warningCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
