import { ExclusionMatchType } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { normalizeText } from "@/lib/utils";

const createSchema = z.object({
  projectId: z.string().min(1),
  term: z.string().min(1),
  category: z.string().optional(),
  matchType: z.nativeEnum(ExclusionMatchType).optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");

  if (!projectId) {
    return jsonError("projectId is required", 400);
  }

  const terms = await prisma.brandExclusionTerm.findMany({
    where: { projectId },
    orderBy: [{ isActive: "desc" }, { category: "asc" }, { term: "asc" }],
  });

  return jsonOk(terms);
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = createSchema.safeParse(payload);

    if (!parsed.success) {
      return jsonError("Invalid exclusion payload", 400, parsed.error.flatten());
    }

    const term = await prisma.brandExclusionTerm.create({
      data: {
        projectId: parsed.data.projectId,
        term: parsed.data.term.trim(),
        normalizedTerm: normalizeText(parsed.data.term),
        category: parsed.data.category?.trim() || null,
        matchType: parsed.data.matchType ?? ExclusionMatchType.CONTAINS,
        notes: parsed.data.notes?.trim() || null,
        isActive: parsed.data.isActive ?? true,
      },
    });

    return jsonOk(term, { status: 201 });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return jsonError("Exclusion term already exists", 409);
    }

    return jsonError("Failed to create exclusion term", 500, String(error));
  }
}
