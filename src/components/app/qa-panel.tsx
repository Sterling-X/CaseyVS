"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type QaIssue = {
  id: string;
  severity: "ERROR" | "WARNING" | "INFO";
  status: "OPEN" | "RESOLVED" | "IGNORED";
  title: string;
  details: string;
  issueType: string;
};

type QaPayload = {
  summary: {
    total: number;
    open: number;
    resolved: number;
    bySeverity: { ERROR: number; WARNING: number; INFO: number };
  };
  issues: QaIssue[];
};

export function QaPanel({ projectId, reportingMonth }: { projectId: string; reportingMonth: string }) {
  const [payload, setPayload] = useState<QaPayload | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(run = false) {
    setLoading(true);
    const response = await fetch(`/api/qa?projectId=${projectId}&reportingMonth=${reportingMonth}&run=${run}`);
    if (response.ok) {
      const data = await response.json();
      setPayload(data);
    }
    setLoading(false);
  }

  async function resolve(issueId: string, status: "RESOLVED" | "IGNORED") {
    await fetch("/api/qa", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueId, status }),
    });
    load(false);
  }

  useEffect(() => {
    load(false);
  }, [projectId, reportingMonth]);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Data Health Summary</CardTitle>
          <CardDescription>Run QA checks to detect import issues and structural mapping gaps.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Total: {payload?.summary.total ?? 0}</Badge>
            <Badge variant="error">Errors: {payload?.summary.bySeverity.ERROR ?? 0}</Badge>
            <Badge variant="warning">Warnings: {payload?.summary.bySeverity.WARNING ?? 0}</Badge>
            <Badge variant="outline">Info: {payload?.summary.bySeverity.INFO ?? 0}</Badge>
            <Badge variant="secondary">Open: {payload?.summary.open ?? 0}</Badge>
          </div>

          <Button onClick={() => load(true)} disabled={loading}>
            {loading ? "Running QA..." : "Run QA Checks"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Issues</CardTitle>
          <CardDescription>Open and resolved quality issues for this project month.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payload?.issues.map((issue) => (
                <TableRow key={issue.id}>
                  <TableCell>
                    <Badge variant={issue.severity === "ERROR" ? "error" : issue.severity === "WARNING" ? "warning" : "secondary"}>
                      {issue.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>{issue.issueType}</TableCell>
                  <TableCell>{issue.title}</TableCell>
                  <TableCell>{issue.details}</TableCell>
                  <TableCell>{issue.status}</TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => resolve(issue.id, "RESOLVED")}>
                      Resolve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => resolve(issue.id, "IGNORED")}>
                      Ignore
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
