import Link from "next/link";
import prisma from "@/lib/prisma";
import { WorkspaceOnboarding } from "@/components/app/workspace-onboarding";
import { ProjectCards } from "@/components/app/project-cards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [projects, templates] = await Promise.all([
    prisma.project.findMany({
      where: { isActive: true },
      include: {
        template: true,
        markets: { where: { isActive: true } },
        _count: {
          select: {
            keywords: true,
            competitors: true,
            importJobs: { where: { status: "COMMITTED" } },
            dataHealthIssues: { where: { status: "OPEN" } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.reportingTemplate.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <WorkspaceOnboarding templates={templates} />

      <Card className="bg-[radial-gradient(1000px_250px_at_0%_0%,#f2d8b6,transparent)]">
        <CardHeader>
          <CardTitle>Monthly Reporting Workflow</CardTitle>
          <CardDescription>
            1) Create/select project. 2) Import monthly exports. 3) Resolve QA issues. 4) Review dashboard and export PDF.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link className="rounded-md border border-stone-200 bg-white p-3 text-sm hover:bg-stone-50" href="/imports">
            Import Center
          </Link>
          <Link className="rounded-md border border-stone-200 bg-white p-3 text-sm hover:bg-stone-50" href="/keywords">
            Keywords
          </Link>
          <Link className="rounded-md border border-stone-200 bg-white p-3 text-sm hover:bg-stone-50" href="/qa">
            QA / Data Health
          </Link>
          <Link className="rounded-md border border-stone-200 bg-white p-3 text-sm hover:bg-stone-50" href="/dashboard">
            Dashboard
          </Link>
        </CardContent>
      </Card>

      {projects.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Projects Yet</CardTitle>
            <CardDescription>
              This workspace starts clean. Create a project from a business URL above, then upload source exports.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ProjectCards projects={projects} />
      )}
    </div>
  );
}
