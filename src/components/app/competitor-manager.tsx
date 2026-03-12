"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Competitor = {
  id: string;
  domain: string;
  name: string | null;
  isPrimary: boolean;
  isActive: boolean;
};

type CoverageRow = {
  competitorDomain: string;
  _count: { competitorDomain: number };
};

export function CompetitorManager({ projectId, reportingMonth }: { projectId: string; reportingMonth: string }) {
  const [domain, setDomain] = useState("");
  const [name, setName] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [message, setMessage] = useState("");
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [coverage, setCoverage] = useState<Record<string, number>>({});

  async function refresh() {
    const [competitorsResponse, coverageResponse] = await Promise.all([
      fetch(`/api/competitors?projectId=${projectId}`),
      fetch(`/api/dashboard?projectId=${projectId}&reportingMonth=${reportingMonth}`),
    ]);

    if (competitorsResponse.ok) {
      const data = await competitorsResponse.json();
      setCompetitors(data);
    }

    if (coverageResponse.ok) {
      const payload = await coverageResponse.json();
      const rows = payload?.competitorSoLv?.byKeyword ?? [];
      const nextCoverage: Record<string, number> = {};
      rows.forEach((row: { competitorDomain: string }) => {
        nextCoverage[row.competitorDomain] = (nextCoverage[row.competitorDomain] ?? 0) + 1;
      });
      setCoverage(nextCoverage);
    }
  }

  useEffect(() => {
    refresh();
  }, [projectId, reportingMonth]);

  async function addCompetitor() {
    const response = await fetch("/api/competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, domain, name, isPrimary }),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Failed to add competitor");
      return;
    }

    setDomain("");
    setName("");
    setIsPrimary(false);
    setMessage("Competitor added");
    refresh();
  }

  async function togglePrimary(competitor: Competitor) {
    await fetch(`/api/competitors/${competitor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPrimary: !competitor.isPrimary }),
    });

    refresh();
  }

  async function archive(competitor: Competitor) {
    await fetch(`/api/competitors/${competitor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !competitor.isActive }),
    });

    refresh();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle>Add Competitor</CardTitle>
          <CardDescription>Track competitor domains for SoLV comparison and cluster-level benchmarking.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Domain</Label>
            <Input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="coastalfamilyattorneys.com" />
          </div>
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Coastal Family Attorneys" />
          </div>
          <Button variant={isPrimary ? "default" : "outline"} onClick={() => setIsPrimary((value) => !value)}>
            {isPrimary ? "Primary Competitor" : "Not Primary"}
          </Button>
          <Button onClick={addCompetitor} disabled={!domain.trim()}>
            Add Competitor
          </Button>
          {message ? <p className="text-sm text-stone-600">{message}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Competitor Coverage</CardTitle>
          <CardDescription>Import coverage count reflects visibility rows seen this month per competitor domain.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Primary</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {competitors.map((competitor) => (
                <TableRow key={competitor.id}>
                  <TableCell className="font-medium">{competitor.domain}</TableCell>
                  <TableCell>{competitor.name ?? "-"}</TableCell>
                  <TableCell>
                    {competitor.isPrimary ? <Badge variant="success">Primary</Badge> : <Badge variant="outline">Secondary</Badge>}
                  </TableCell>
                  <TableCell>{coverage[competitor.domain] ?? 0}</TableCell>
                  <TableCell>{competitor.isActive ? "Active" : "Archived"}</TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => togglePrimary(competitor)}>
                      Toggle Primary
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => archive(competitor)}>
                      {competitor.isActive ? "Archive" : "Restore"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
