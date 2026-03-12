import { z } from "zod";
import prisma from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { normalizeDomain } from "@/lib/utils";

const competitorSchema = z.object({
  projectId: z.string().min(1),
  domain: z.string().min(1),
  name: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId");

    if (!projectId) {
      return jsonError("projectId is required", 400);
    }

    const competitors = await prisma.competitor.findMany({
      where: { projectId, isActive: true },
      orderBy: [{ isPrimary: "desc" }, { domain: "asc" }],
    });

    return jsonOk(competitors);
  } catch (error) {
    return jsonError("Failed to fetch competitors", 500, String(error));
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = competitorSchema.safeParse(payload);

    if (!parsed.success) {
      return jsonError("Invalid competitor payload", 400, parsed.error.flatten());
    }

    const domain = normalizeDomain(parsed.data.domain);

    const competitor = await prisma.competitor.create({
      data: {
        projectId: parsed.data.projectId,
        domain,
        normalizedDomain: domain,
        name: parsed.data.name?.trim() || null,
        isPrimary: parsed.data.isPrimary ?? false,
      },
    });

    return jsonOk(competitor, { status: 201 });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return jsonError("Competitor already exists in this project", 409);
    }

    return jsonError("Failed to create competitor", 500, String(error));
  }
}
