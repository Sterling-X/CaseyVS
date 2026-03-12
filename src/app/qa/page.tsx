import prisma from "@/lib/prisma";
import { ProjectMonthControls } from "@/components/app/project-month-controls";
import { QaPanel } from "@/components/app/qa-panel";
import { NoProjectState } from "@/components/app/no-project-state";

export const dynamic = "force-dynamic";


function defaultMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default async function QaPage({
  searchParams,
}: {
  searchParams: { projectId?: string; reportingMonth?: string };
}) {
  const projects = await prisma.project.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });

  if (!projects.length) {
    return <NoProjectState title="QA Panel Requires A Project" />;
  }

  const currentProjectId = searchParams.projectId && projects.some((project) => project.id === searchParams.projectId)
    ? searchParams.projectId
    : projects[0].id;

  const reportingMonth = searchParams.reportingMonth ?? defaultMonth();

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">QA / Data Health</h2>
      <ProjectMonthControls projects={projects} currentProjectId={currentProjectId} currentMonth={reportingMonth} />
      <QaPanel projectId={currentProjectId} reportingMonth={reportingMonth} />
    </div>
  );
}
