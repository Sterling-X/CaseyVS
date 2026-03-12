import { z } from "zod";
import prisma from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { normalizeDomain, slugify } from "@/lib/utils";

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  industry: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  domain: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  templateId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(_request: Request, context: { params: { id: string } }) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: context.params.id },
      include: {
        template: true,
        markets: { where: { isActive: true }, orderBy: { name: "asc" } },
        intentGroups: { where: { isActive: true }, orderBy: { name: "asc" } },
        competitors: { where: { isActive: true }, orderBy: [{ isPrimary: "desc" }, { domain: "asc" }] },
        keywordSets: { where: { isActive: true }, orderBy: { createdAt: "asc" } },
      },
    });

    if (!project) {
      return jsonError("Project not found", 404);
    }

    return jsonOk(project);
  } catch (error) {
    return jsonError("Failed to fetch project", 500, String(error));
  }
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const payload = await request.json();
    const parsed = updateProjectSchema.safeParse(payload);

    if (!parsed.success) {
      return jsonError("Invalid project payload", 400, parsed.error.flatten());
    }

    const data = {
      ...parsed.data,
      ...(parsed.data.domain
        ? {
            domain: normalizeDomain(parsed.data.domain),
            normalizedDomain: normalizeDomain(parsed.data.domain),
          }
        : {}),
      ...(parsed.data.name ? { slug: slugify(parsed.data.name) } : {}),
    };

    const project = await prisma.project.update({
      where: { id: context.params.id },
      data,
      include: {
        template: true,
        markets: { where: { isActive: true } },
      },
    });

    return jsonOk(project);
  } catch (error) {
    return jsonError("Failed to update project", 500, String(error));
  }
}

export async function DELETE(request: Request, context: { params: { id: string } }) {
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode");

    if (mode === "hard") {
      await prisma.project.delete({
        where: { id: context.params.id },
      });
      return jsonOk({ success: true, deleted: true });
    }

    await prisma.project.update({
      where: { id: context.params.id },
      data: { isActive: false },
    });

    return jsonOk({ success: true });
  } catch (error) {
    return jsonError("Failed to delete project", 500, String(error));
  }
}
