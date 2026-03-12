import { z } from "zod";
import prisma from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { normalizeDomain } from "@/lib/utils";

const updateSchema = z.object({
  domain: z.string().min(1).optional(),
  name: z.string().nullable().optional(),
  isPrimary: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const payload = await request.json();
    const parsed = updateSchema.safeParse(payload);

    if (!parsed.success) {
      return jsonError("Invalid competitor payload", 400, parsed.error.flatten());
    }

    const competitor = await prisma.competitor.update({
      where: { id: context.params.id },
      data: {
        ...parsed.data,
        ...(parsed.data.domain
          ? {
              domain: normalizeDomain(parsed.data.domain),
              normalizedDomain: normalizeDomain(parsed.data.domain),
            }
          : {}),
      },
    });

    return jsonOk(competitor);
  } catch (error) {
    return jsonError("Failed to update competitor", 500, String(error));
  }
}

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  try {
    await prisma.competitor.update({
      where: { id: context.params.id },
      data: { isActive: false },
    });

    return jsonOk({ success: true });
  } catch (error) {
    return jsonError("Failed to archive competitor", 500, String(error));
  }
}
