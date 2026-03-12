import prisma from "@/lib/prisma";
import { ProjectMonthControls } from "@/components/app/project-month-controls";
import { KeywordManager } from "@/components/app/keyword-manager";
import { NoProjectState } from "@/components/app/no-project-state";

export const dynamic = "force-dynamic";


function defaultMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default async function KeywordsPage({
  searchParams,
}: {
  searchParams: { projectId?: string; reportingMonth?: string };
}) {
  const projects = await prisma.project.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });

  if (projects.length === 0) {
    return <NoProjectState title="Keyword Management Requires A Project" />;
  }

  const currentProjectId = searchParams.projectId && projects.some((item) => item.id === searchParams.projectId)
    ? searchParams.projectId
    : projects[0].id;
  const reportingMonth = searchParams.reportingMonth ?? defaultMonth();

  const [markets, intentGroups, keywordSets] = await Promise.all([
    prisma.market.findMany({ where: { projectId: currentProjectId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.intentGroup.findMany({ where: { projectId: currentProjectId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.keywordSet.findMany({ where: { projectId: currentProjectId, isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">Keyword Management</h2>
      <ProjectMonthControls projects={projects} currentProjectId={currentProjectId} currentMonth={reportingMonth} />
      <KeywordManager projectId={currentProjectId} markets={markets} intentGroups={intentGroups} keywordSets={keywordSets} />
    </div>
  );
}
