import { ExclusionMatchType } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { normalizeText } from "@/lib/utils";

const updateSchema = z.object({
  term: z.string().min(1).optional(),
  category: z.string().nullable().optional(),
  matchType: z.nativeEnum(ExclusionMatchType).optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const payload = await request.json();
    const parsed = updateSchema.safeParse(payload);

    if (!parsed.success) {
      return jsonError("Invalid exclusion payload", 400, parsed.error.flatten());
    }

    const updated = await prisma.brandExclusionTerm.update({
      where: { id: context.params.id },
      data: {
        ...parsed.data,
        ...(parsed.data.term
          ? {
              term: parsed.data.term.trim(),
              normalizedTerm: normalizeText(parsed.data.term),
            }
          : {}),
      },
    });

    return jsonOk(updated);
  } catch (error) {
    return jsonError("Failed to update term", 500, String(error));
  }
}

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  try {
    await prisma.brandExclusionTerm.delete({ where: { id: context.params.id } });
    return jsonOk({ success: true });
  } catch (error) {
    return jsonError("Failed to delete term", 500, String(error));
  }
}
