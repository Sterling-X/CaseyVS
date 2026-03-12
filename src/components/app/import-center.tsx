"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";

type Issue = {
  rowNumber: number | null;
  field: string | null;
  message: string;
  severity: "ERROR" | "WARNING" | "INFO";
};

type RequiredField = {
  key: string;
  label: string;
  required: boolean;
};

type ImportJob = {
  id: string;
  sourceType: string;
  status: string;
  fileName: string;
  reportingMonth: string;
  rowCount: number;
  validRowCount: number;
  errorCount: number;
  warningCount: number;
  createdAt: string;
};

const SOURCE_OPTIONS = [
  { value: "SEMRUSH_RANKINGS_OVERVIEW", label: "Semrush Rankings Overview (Wide Matrix)" },
  { value: "GSC_PERFORMANCE_ZIP", label: "Google Search Console Performance ZIP" },
  { value: "SEMRUSH_VISIBILITY", label: "Semrush SoLV / Visibility" },
  { value: "SEMRUSH_MAP_PACK", label: "Semrush Map Pack" },
  { value: "SEMRUSH_ORGANIC", label: "Semrush Organic" },
  { value: "GSC_QUERY", label: "Google Search Console Queries" },
] as const;

export function ImportCenter({ projectId, reportingMonth }: { projectId: string; reportingMonth: string }) {
  const [sourceType, setSourceType] = useState<(typeof SOURCE_OPTIONS)[number]["value"]>("SEMRUSH_RANKINGS_OVERVIEW");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [requiredFields, setRequiredFields] = useState<RequiredField[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingCommit, setLoadingCommit] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [saveMappingName, setSaveMappingName] = useState("");
  const [history, setHistory] = useState<ImportJob[]>([]);
  const [message, setMessage] = useState<string>("");

  const errorCount = useMemo(() => issues.filter((item) => item.severity === "ERROR").length, [issues]);
  const warningCount = useMemo(() => issues.filter((item) => item.severity === "WARNING").length, [issues]);

  const canPreview = file !== null;
  const isAutoMappedSource = sourceType === "SEMRUSH_RANKINGS_OVERVIEW" || sourceType === "GSC_PERFORMANCE_ZIP";
  const canCommit = file !== null && (isAutoMappedSource || headers.length > 0) && errorCount === 0;

  async function refreshHistory() {
    const response = await fetch(`/api/imports?projectId=${projectId}`);
    if (!response.ok) return;

    const data = await response.json();
    setHistory(data);
  }

  useEffect(() => {
    refreshHistory();
  }, [projectId]);

  useEffect(() => {
    setHeaders([]);
    setRequiredFields([]);
    setMapping({});
    setPreviewRows([]);
    setIssues([]);
    setMessage("");
  }, [sourceType]);

  async function handlePreview() {
    if (!file) {
      return;
    }

    setLoadingPreview(true);
    setMessage("");

    const form = new FormData();
    form.set("file", file);
    form.set("projectId", projectId);
    form.set("sourceType", sourceType);
    form.set("reportingMonth", reportingMonth);
    if (Object.keys(mapping).length > 0) {
      form.set("mapping", JSON.stringify(mapping));
    }

    try {
      const response = await fetch("/api/imports/preview", {
        method: "POST",
        body: form,
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        setMessage(`Preview failed (HTTP ${response.status}). The server did not return JSON.`);
        setLoadingPreview(false);
        return;
      }

      if (!response.ok) {
        const detail = data?.details ? ` (${String(data.details)})` : "";
        setMessage((data?.error ?? "Failed to preview import") + detail);
        setLoadingPreview(false);
        return;
      }

      setHeaders(data.headers ?? []);
      setRequiredFields(data.requiredFields ?? []);
      setMapping(data.mapping ?? {});
      setPreviewRows(data.previewRows ?? []);
      setIssues(data.issues ?? []);
      setMessage("Preview ready. Review mapping and validation before commit.");
      setLoadingPreview(false);
    } catch (error) {
      setMessage(`Failed to preview import (${String(error)})`);
      setLoadingPreview(false);
    }
  }

  async function handleCommit() {
    if (!file) {
      return;
    }

    setLoadingCommit(true);
    setMessage("");

    const form = new FormData();
    form.set("file", file);
    form.set("projectId", projectId);
    form.set("sourceType", sourceType);
    form.set("reportingMonth", reportingMonth);
    form.set("mapping", JSON.stringify(mapping));
    form.set("replaceExisting", String(replaceExisting));
    if (saveMappingName.trim()) {
      form.set("saveMappingProfileName", saveMappingName.trim());
    }

    try {
      const response = await fetch("/api/imports/commit", {
        method: "POST",
        body: form,
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        setMessage(`Commit failed (HTTP ${response.status}). The server did not return JSON.`);
        setLoadingCommit(false);
        return;
      }

      if (!response.ok) {
        const detail = data?.details ? ` (${String(data.details)})` : "";
        setMessage((data?.error ?? "Failed to commit import") + detail);
        setLoadingCommit(false);
        return;
      }

      setIssues(data.issues ?? []);
      setMessage(data.committed ? "Import committed successfully." : "Import failed validation and was not committed.");
      setLoadingCommit(false);
      refreshHistory();
    } catch (error) {
      setMessage(`Failed to commit import (${String(error)})`);
      setLoadingCommit(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Import Wizard</CardTitle>
          <CardDescription>Upload raw export, map columns, preview transformed rows, and commit normalized records.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Source Type</Label>
              <Select value={sourceType} onValueChange={(value) => setSourceType(value as (typeof SOURCE_OPTIONS)[number]["value"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Upload File</Label>
              <Input type="file" accept=".csv,.xlsx,.xls,.zip" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox checked={replaceExisting} onCheckedChange={(value) => setReplaceExisting(Boolean(value))} id="replace-existing" />
            <Label htmlFor="replace-existing">Replace existing records for this source + month</Label>
          </div>

          <div className="space-y-1.5">
            <Label>Save Mapping Profile Name (optional)</Label>
            <Input value={saveMappingName} onChange={(event) => setSaveMappingName(event.target.value)} placeholder="e.g., Semrush Visibility Default" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handlePreview} disabled={!canPreview || loadingPreview}>
              <Upload className="mr-2 h-4 w-4" />
              {loadingPreview ? "Previewing..." : "Build Preview"}
            </Button>
            <Button variant="secondary" onClick={handleCommit} disabled={!canCommit || loadingCommit}>
              {loadingCommit ? "Committing..." : "Commit Import"}
            </Button>
          </div>

          {message ? (
            <Alert variant={errorCount > 0 ? "error" : "success"}>
              <AlertTitle>{errorCount > 0 ? "Validation Issues Found" : "Status"}</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}

          {requiredFields.length > 0 && !isAutoMappedSource ? (
            <div className="space-y-2 rounded-md border border-stone-200 p-3">
              <h4 className="text-sm font-semibold">Column Mapping</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {requiredFields.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <Label>
                      {field.label} {field.required ? <span className="text-red-600">*</span> : null}
                    </Label>
                    <Select
                      value={mapping[field.key] ?? "__unmapped__"}
                      onValueChange={(value) =>
                        setMapping((current) => ({
                          ...current,
                          [field.key]: value === "__unmapped__" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select source column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unmapped__">Unmapped</SelectItem>
                        {headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {isAutoMappedSource ? (
            <Alert>
              <AlertTitle>Automatic mapping enabled</AlertTitle>
              <AlertDescription>
                This source uses server-side adapters to detect and map fields automatically from the raw export structure.
              </AlertDescription>
            </Alert>
          ) : null}

          {previewRows.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Transformed Preview ({formatNumber(previewRows.length)} rows shown)</h4>
              <div className="max-h-80 overflow-auto rounded-md border border-stone-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(previewRows[0] ?? {}).map((key) => (
                        <TableHead key={key}>{key}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {Object.keys(previewRows[0] ?? {}).map((key) => (
                          <TableCell key={key}>{String(row[key] ?? "")}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}

          {issues.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant={errorCount > 0 ? "error" : "warning"}>Errors: {errorCount}</Badge>
                <Badge variant="warning">Warnings: {warningCount}</Badge>
              </div>
              <div className="max-h-60 overflow-auto rounded-md border border-stone-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severity</TableHead>
                      <TableHead>Row</TableHead>
                      <TableHead>Field</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issues.slice(0, 200).map((issue, index) => (
                      <TableRow key={`${issue.rowNumber ?? "global"}-${index}`}>
                        <TableCell>
                          <Badge variant={issue.severity === "ERROR" ? "error" : issue.severity === "WARNING" ? "warning" : "secondary"}>
                            {issue.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>{issue.rowNumber ?? "-"}</TableCell>
                        <TableCell>{issue.field ?? "-"}</TableCell>
                        <TableCell>{issue.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import History</CardTitle>
          <CardDescription>Recent import jobs for this project with validation outcomes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 ? (
            <Alert>
              <AlertTriangle className="mb-2 h-4 w-4" />
              <AlertTitle>No imports yet</AlertTitle>
              <AlertDescription>Upload a Semrush or GSC export to start building monthly snapshots.</AlertDescription>
            </Alert>
          ) : null}

          {history.map((job) => (
            <div key={job.id} className="rounded-md border border-stone-200 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="font-medium">{job.fileName}</div>
                <Badge variant={job.status === "COMMITTED" ? "success" : job.status === "FAILED" ? "error" : "secondary"}>{job.status}</Badge>
              </div>
              <div className="text-xs text-stone-600">{job.sourceType} • {job.reportingMonth.slice(0, 10)}</div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-stone-700">
                <div>Rows: {job.rowCount}</div>
                <div>Valid: {job.validRowCount}</div>
                <div>Errors: {job.errorCount}</div>
              </div>
            </div>
          ))}

          {history.length > 0 ? (
            <div className="flex items-center gap-2 text-xs text-stone-600">
              <CheckCircle2 className="h-4 w-4" />
              Import audit trail includes validation issue rows and raw file metadata.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
