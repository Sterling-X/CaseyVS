"use client";

import { useEffect, useMemo, useState } from "react";
import { ExclusionMatchType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type ExclusionTerm = {
  id: string;
  term: string;
  category: string | null;
  matchType: ExclusionMatchType;
  isActive: boolean;
};

const matchTypeOptions = [
  ExclusionMatchType.CONTAINS,
  ExclusionMatchType.EXACT,
  ExclusionMatchType.STARTS_WITH,
  ExclusionMatchType.ENDS_WITH,
  ExclusionMatchType.REGEX,
];

export function ExclusionManager({ projectId, reportingMonth }: { projectId: string; reportingMonth: string }) {
  const [brandTerms, setBrandTerms] = useState<ExclusionTerm[]>([]);
  const [pageTerms, setPageTerms] = useState<ExclusionTerm[]>([]);
  const [message, setMessage] = useState("");

  const [brandTerm, setBrandTerm] = useState("");
  const [brandCategory, setBrandCategory] = useState("");
  const [brandMatchType, setBrandMatchType] = useState<ExclusionMatchType>(ExclusionMatchType.CONTAINS);

  const [pageTerm, setPageTerm] = useState("");
  const [pageCategory, setPageCategory] = useState("");
  const [pageMatchType, setPageMatchType] = useState<ExclusionMatchType>(ExclusionMatchType.CONTAINS);

  const [includedQueries, setIncludedQueries] = useState<Array<{ query: string; clicks: number; impressions: number }>>([]);
  const [excludedQueries, setExcludedQueries] = useState<
    Array<{ query: string; clicks: number; impressions: number; reasons: Array<{ type: string; term: string; category: string | null }> }>
  >([]);

  async function refresh() {
    const [brandResponse, pageResponse, dashboardResponse] = await Promise.all([
      fetch(`/api/exclusions/brand?projectId=${projectId}`),
      fetch(`/api/exclusions/page?projectId=${projectId}`),
      fetch(`/api/dashboard?projectId=${projectId}&reportingMonth=${reportingMonth}`),
    ]);

    if (brandResponse.ok) setBrandTerms(await brandResponse.json());
    if (pageResponse.ok) setPageTerms(await pageResponse.json());

    if (dashboardResponse.ok) {
      const payload = await dashboardResponse.json();
      setIncludedQueries(payload.gsc?.includedQueries ?? []);
      setExcludedQueries(payload.gsc?.excludedQueries ?? []);
    }
  }

  useEffect(() => {
    refresh();
  }, [projectId, reportingMonth]);

  const excludedReasonCount = useMemo(() => {
    const counts: Record<string, number> = {};
    excludedQueries.forEach((row) => {
      (row.reasons ?? []).forEach((reason) => {
        const key = `${reason.type}:${reason.term}`;
        counts[key] = (counts[key] ?? 0) + 1;
      });
    });
    return counts;
  }, [excludedQueries]);

  async function addBrandTerm() {
    const response = await fetch("/api/exclusions/brand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        term: brandTerm,
        category: brandCategory,
        matchType: brandMatchType,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Failed to create brand term");
      return;
    }

    setBrandTerm("");
    setBrandCategory("");
    setMessage("Brand exclusion term added");
    refresh();
  }

  async function addPageTerm() {
    const response = await fetch("/api/exclusions/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        term: pageTerm,
        category: pageCategory,
        matchType: pageMatchType,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Failed to create page term");
      return;
    }

    setPageTerm("");
    setPageCategory("");
    setMessage("Page-specific exclusion term added");
    refresh();
  }

  async function deleteBrandTerm(id: string) {
    await fetch(`/api/exclusions/brand/${id}`, { method: "DELETE" });
    refresh();
  }

  async function deletePageTerm(id: string) {
    await fetch(`/api/exclusions/page/${id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div className="space-y-5">
      {message ? <p className="text-sm text-stone-600">{message}</p> : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Brand Exclusions</CardTitle>
            <CardDescription>Firm names, attorney names, abbreviations, and branded phrases.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Input value={brandTerm} onChange={(event) => setBrandTerm(event.target.value)} placeholder="casey law" />
              <Input value={brandCategory} onChange={(event) => setBrandCategory(event.target.value)} placeholder="ABBREVIATION" />
              <Select value={brandMatchType} onValueChange={(value) => setBrandMatchType(value as ExclusionMatchType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {matchTypeOptions.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={addBrandTerm} disabled={!brandTerm.trim()}>Add Brand Term</Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Term</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {brandTerms.map((term) => (
                  <TableRow key={term.id}>
                    <TableCell>{term.term}</TableCell>
                    <TableCell>{term.category ?? "-"}</TableCell>
                    <TableCell>{term.matchType}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => deleteBrandTerm(term.id)}>Delete</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Page-Specific Exclusions</CardTitle>
            <CardDescription>Attorney bio fragments, location page fragments, and page-specific terms.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Input value={pageTerm} onChange={(event) => setPageTerm(event.target.value)} placeholder="attorney profile" />
              <Input value={pageCategory} onChange={(event) => setPageCategory(event.target.value)} placeholder="ATTORNEY_BIO" />
              <Select value={pageMatchType} onValueChange={(value) => setPageMatchType(value as ExclusionMatchType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {matchTypeOptions.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={addPageTerm} disabled={!pageTerm.trim()}>Add Page Term</Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Term</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageTerms.map((term) => (
                  <TableRow key={term.id}>
                    <TableCell>{term.term}</TableCell>
                    <TableCell>{term.category ?? "-"}</TableCell>
                    <TableCell>{term.matchType}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => deletePageTerm(term.id)}>Delete</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>GSC Exclusion Audit</CardTitle>
          <CardDescription>
            Included and excluded query visibility with explicit reason tracking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">Included queries: {includedQueries.length}</Badge>
            <Badge variant="warning">Excluded queries: {excludedQueries.length}</Badge>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-semibold">Top Included Queries</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Query</TableHead>
                    <TableHead>Clicks</TableHead>
                    <TableHead>Impressions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {includedQueries.slice(0, 20).map((query) => (
                    <TableRow key={query.query}>
                      <TableCell>{query.query}</TableCell>
                      <TableCell>{query.clicks}</TableCell>
                      <TableCell>{query.impressions}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold">Excluded Query Reasons</h4>
              <div className="space-y-2">
                {Object.entries(excludedReasonCount)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 20)
                  .map(([reason, count]) => (
                    <div key={reason} className="flex items-center justify-between rounded-md border border-stone-200 px-3 py-2 text-sm">
                      <span>{reason}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
