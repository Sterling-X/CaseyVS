import { z } from "zod";
import prisma from "@/lib/prisma";
import { getDashboardPayload } from "@/lib/dashboard/service";
import { jsonError, jsonOk } from "@/lib/api";
import { monthStart } from "@/lib/utils";

const createSnapshotSchema = z.object({
  projectId: z.string().min(1),
  reportingMonth: z.string().regex(/^\d{4}-\d{2}$/),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");

  if (!projectId) {
    return jsonError("projectId is required", 400);
  }

  const snapshots = await prisma.dashboardSnapshot.findMany({
    where: { projectId },
    orderBy: { reportingMonth: "desc" },
  });

  return jsonOk(snapshots);
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = createSnapshotSchema.safeParse(payload);

    if (!parsed.success) {
      return jsonError("Invalid snapshot payload", 400, parsed.error.flatten());
    }

    const reportingMonth = monthStart(parsed.data.reportingMonth);
    const snapshotData = await getDashboardPayload(parsed.data.projectId, reportingMonth, {
      activeOnly: true,
      primaryTargetOnly: false,
    });

    const snapshot = await prisma.dashboardSnapshot.upsert({
      where: {
        projectId_reportingMonth: {
          projectId: parsed.data.projectId,
          reportingMonth,
        },
      },
      create: {
        projectId: parsed.data.projectId,
        reportingMonth,
        snapshotData,
      },
      update: {
        snapshotData,
        generatedAt: new Date(),
      },
    });

    return jsonOk(snapshot);
  } catch (error) {
    return jsonError("Failed to save snapshot", 500, String(error));
  }
}
