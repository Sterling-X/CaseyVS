"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TemplateOption = {
  id: string;
  name: string;
};

function extractDomain(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const withProtocol = /^(https?:)?\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withProtocol).hostname;
  } catch {
    return trimmed;
  }
}

function defaultProjectNameFromDomain(domain: string) {
  const stripped = domain.replace(/^www\./i, "").trim();
  if (!stripped) {
    return "";
  }

  const root = stripped.split(".")[0] ?? stripped;
  return root
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function WorkspaceOnboarding({ templates }: { templates: TemplateOption[] }) {
  const router = useRouter();
  const [businessUrl, setBusinessUrl] = useState("");
  const [projectName, setProjectName] = useState("");
  const [industry, setIndustry] = useState("");
  const [category, setCategory] = useState("");
  const [marketsInput, setMarketsInput] = useState("");
  const [templateId, setTemplateId] = useState<string>(templates[0]?.id ?? "none");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const detectedDomain = useMemo(() => extractDomain(businessUrl), [businessUrl]);

  async function createProject() {
    const domain = extractDomain(businessUrl);
    if (!domain) {
      setMessage("Business URL is required.");
      return;
    }

    const inferredName = projectName.trim() || defaultProjectNameFromDomain(domain) || domain;
    const markets = marketsInput
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean);

    setSubmitting(true);
    setMessage("");

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: inferredName,
        domain,
        industry: industry.trim() || undefined,
        category: category.trim() || undefined,
        templateId: templateId === "none" ? undefined : templateId,
        markets,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data?.error ?? "Failed to create project.");
      setSubmitting(false);
      return;
    }

    const month = new Date().toISOString().slice(0, 7);
    router.push(`/imports?projectId=${data.id}&reportingMonth=${month}`);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start A New Reporting Workspace</CardTitle>
        <CardDescription>
          Step 1: enter the business URL. Step 2: import Semrush and GSC exports. Step 3: review dashboards and export PDF.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Business URL</Label>
            <Input
              value={businessUrl}
              onChange={(event) => setBusinessUrl(event.target.value)}
              placeholder="https://familylawfirm.com"
            />
            <p className="text-xs text-stone-500">Detected domain: {detectedDomain || "-"}</p>
          </div>

          <div className="space-y-1.5">
            <Label>Project Name (optional)</Label>
            <Input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="Family Law Monthly Visibility"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                {templates.length ? (
                  templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none">No template</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Industry (optional)</Label>
            <Input value={industry} onChange={(event) => setIndustry(event.target.value)} placeholder="Family Law" />
          </div>

          <div className="space-y-1.5">
            <Label>Category (optional)</Label>
            <Input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Legal Services" />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>Markets (optional)</Label>
            <Input
              value={marketsInput}
              onChange={(event) => setMarketsInput(event.target.value)}
              placeholder="Miami, Fort Lauderdale, Orlando"
            />
          </div>
        </div>

        {message ? <p className="text-sm text-red-700">{message}</p> : null}

        <Button onClick={createProject} disabled={submitting || !businessUrl.trim()}>
          {submitting ? "Creating..." : "Create Project And Continue To Imports"}
        </Button>
      </CardContent>
    </Card>
  );
}
