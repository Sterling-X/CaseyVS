import { KeywordType } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { normalizeText } from "@/lib/utils";

const updateKeywordSchema = z.object({
  text: z.string().min(1).optional(),
  keywordType: z.nativeEnum(KeywordType).optional(),
  intentGroupId: z.string().nullable().optional(),
  marketId: z.string().nullable().optional(),
  keywordSetId: z.string().nullable().optional(),
  isPrimaryTarget: z.boolean().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const payload = await request.json();
    const parsed = updateKeywordSchema.safeParse(payload);

    if (!parsed.success) {
      return jsonError("Invalid keyword payload", 400, parsed.error.flatten());
    }

    const keyword = await prisma.keyword.update({
      where: { id: context.params.id },
      data: {
        ...parsed.data,
        ...(parsed.data.text
          ? {
              text: parsed.data.text.trim(),
              normalizedText: normalizeText(parsed.data.text),
            }
          : {}),
      },
      include: {
        market: true,
        intentGroup: true,
      },
    });

    return jsonOk(keyword);
  } catch (error) {
    return jsonError("Failed to update keyword", 500, String(error));
  }
}

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  try {
    await prisma.keyword.update({
      where: { id: context.params.id },
      data: { isActive: false },
    });

    return jsonOk({ success: true });
  } catch (error) {
    return jsonError("Failed to archive keyword", 500, String(error));
  }
}
