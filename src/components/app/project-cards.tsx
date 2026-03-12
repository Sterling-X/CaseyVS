"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";

type ProjectCardItem = {
  id: string;
  name: string;
  domain: string;
  industry: string | null;
  markets: Array<{ id: string; name: string }>;
  template: { name: string } | null;
  _count: {
    keywords: number;
    competitors: number;
    importJobs: number;
    dataHealthIssues: number;
  };
};

export function ProjectCards({ projects }: { projects: ProjectCardItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(projects);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);

  async function deleteProject(project: ProjectCardItem) {
    const confirmed = window.confirm(
      `Delete project \"${project.name}\"? This permanently removes imports, keywords, competitors, snapshots, and QA history.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(project.id);
    setMessage("");

    const response = await fetch(`/api/projects/${project.id}?mode=hard`, {
      method: "DELETE",
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data?.error ?? "Failed to delete project.");
      setDeletingId(null);
      return;
    }

    setItems((current) => current.filter((item) => item.id !== project.id));
    setDeletingId(null);
    setMessage(`Deleted project: ${project.name}`);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {message ? <p className="text-sm text-stone-700">{message}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((project) => (
          <Card key={project.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>{project.name}</span>
                {project.template ? <Badge variant="secondary">{project.template.name}</Badge> : null}
              </CardTitle>
              <CardDescription>{project.domain}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-stone-700">
              <p>Industry: {project.industry ?? "-"}</p>
              <p>Markets: {project.markets.map((market) => market.name).join(", ") || "-"}</p>
              <p>Keywords: {formatNumber(project._count.keywords)}</p>
              <p>Competitors: {formatNumber(project._count.competitors)}</p>
              <p>Committed Imports: {formatNumber(project._count.importJobs)}</p>
              <p>Open QA issues: {formatNumber(project._count.dataHealthIssues)}</p>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/imports?projectId=${project.id}&reportingMonth=${currentMonth}`}>
                    Continue In Import Center
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteProject(project)}
                  disabled={deletingId === project.id}
                >
                  {deletingId === project.id ? "Deleting..." : "Delete Project"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
