import { z } from "zod";
import prisma from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { normalizeDomain, slugify, normalizeText } from "@/lib/utils";

const createProjectSchema = z.object({
  name: z.string().min(1),
  industry: z.string().optional(),
  category: z.string().optional(),
  domain: z.string().min(1),
  description: z.string().optional(),
  templateId: z.string().optional(),
  markets: z.array(z.string().min(1)).optional(),
});

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      where: { isActive: true },
      include: {
        template: { select: { id: true, name: true, slug: true } },
        markets: { where: { isActive: true }, orderBy: { name: "asc" } },
        _count: {
          select: {
            importJobs: { where: { status: "COMMITTED" } },
            keywords: true,
            competitors: true,
            dataHealthIssues: { where: { status: "OPEN" } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return jsonOk(projects);
  } catch (error) {
    return jsonError("Failed to fetch projects", 500, String(error));
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = createProjectSchema.safeParse(payload);

    if (!parsed.success) {
      return jsonError("Invalid project payload", 400, parsed.error.flatten());
    }

    const domain = normalizeDomain(parsed.data.domain);
    const fallbackTemplate = parsed.data.templateId
      ? null
      : await prisma.reportingTemplate.findFirst({
          select: { id: true },
          orderBy: { createdAt: "asc" },
        });

    const project = await prisma.project.create({
      data: {
        name: parsed.data.name.trim(),
        slug: slugify(parsed.data.name),
        industry: parsed.data.industry?.trim() || null,
        category: parsed.data.category?.trim() || null,
        domain,
        normalizedDomain: domain,
        description: parsed.data.description?.trim() || null,
        templateId: parsed.data.templateId ?? fallbackTemplate?.id ?? null,
        markets: parsed.data.markets?.length
          ? {
              create: parsed.data.markets.map((market) => ({
                name: market.trim(),
                normalizedName: normalizeText(market),
              })),
            }
          : undefined,
      },
      include: {
        template: true,
        markets: true,
      },
    });

    return jsonOk(project, { status: 201 });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return jsonError("A project with that domain or slug already exists.", 409);
    }

    return jsonError("Failed to create project", 500, String(error));
  }
}
