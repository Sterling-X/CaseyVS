import prisma from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId");

    if (!projectId) {
      return jsonError("projectId is required", 400);
    }

    const jobs = await prisma.importJob.findMany({
      where: { projectId },
      include: {
        mappingProfile: { select: { id: true, name: true } },
        validationIssues: {
          orderBy: [{ severity: "desc" }, { rowNumber: "asc" }],
          take: 25,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return jsonOk(jobs);
  } catch (error) {
    return jsonError("Failed to fetch import history", 500, String(error));
  }
}
