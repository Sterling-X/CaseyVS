import { KeywordType } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";

const pairSchema = z.object({
  projectId: z.string().min(1),
  localKeywordId: z.string().min(1),
  coreKeywordId: z.string().min(1),
  notes: z.string().optional(),
});

const unpairSchema = z.object({
  pairId: z.string().min(1),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");

  if (!projectId) {
    return jsonError("projectId is required", 400);
  }

  const pairs = await prisma.keywordPair.findMany({
    where: { projectId, isActive: true },
    include: {
      localKeyword: { include: { market: true, intentGroup: true } },
      coreKeyword: { include: { market: true, intentGroup: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return jsonOk(pairs);
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = pairSchema.safeParse(payload);

    if (!parsed.success) {
      return jsonError("Invalid pair payload", 400, parsed.error.flatten());
    }

    const local = await prisma.keyword.findUnique({ where: { id: parsed.data.localKeywordId } });
    const core = await prisma.keyword.findUnique({ where: { id: parsed.data.coreKeywordId } });

    if (!local || !core) {
      return jsonError("Keyword not found", 404);
    }

    if (local.keywordType !== KeywordType.LOCAL || core.keywordType !== KeywordType.CORE) {
      return jsonError("Pairs require LOCAL keyword as local side and CORE keyword as core side", 400);
    }

    if (local.projectId !== parsed.data.projectId || core.projectId !== parsed.data.projectId) {
      return jsonError("Keywords must belong to the selected project", 400);
    }

    await prisma.keywordPair.updateMany({
      where: {
        projectId: parsed.data.projectId,
        OR: [{ localKeywordId: parsed.data.localKeywordId }, { coreKeywordId: parsed.data.coreKeywordId }],
      },
      data: {
        isActive: false,
      },
    });

    const pair = await prisma.keywordPair.create({
      data: {
        projectId: parsed.data.projectId,
        localKeywordId: parsed.data.localKeywordId,
        coreKeywordId: parsed.data.coreKeywordId,
        notes: parsed.data.notes ?? null,
      },
      include: {
        localKeyword: true,
        coreKeyword: true,
      },
    });

    return jsonOk(pair, { status: 201 });
  } catch (error) {
    return jsonError("Failed to create keyword pair", 500, String(error));
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = await request.json();
    const parsed = unpairSchema.safeParse(payload);

    if (!parsed.success) {
      return jsonError("Invalid unpair payload", 400, parsed.error.flatten());
    }

    await prisma.keywordPair.update({
      where: { id: parsed.data.pairId },
      data: { isActive: false },
    });

    return jsonOk({ success: true });
  } catch (error) {
    return jsonError("Failed to remove keyword pair", 500, String(error));
  }
}
