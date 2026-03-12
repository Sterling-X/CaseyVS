import { KeywordType } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { normalizeText } from "@/lib/utils";

const keywordInputSchema = z.object({
  text: z.string().min(1),
  keywordType: z.nativeEnum(KeywordType),
  intentGroupId: z.string().nullable().optional(),
  marketId: z.string().nullable().optional(),
  keywordSetId: z.string().nullable().optional(),
  projectId: z.string().min(1),
  isPrimaryTarget: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

const keywordBulkSchema = z.object({
  projectId: z.string().min(1),
  keywords: z.array(keywordInputSchema.omit({ projectId: true })),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId");
    const keywordType = url.searchParams.get("keywordType") as KeywordType | null;
    const intentGroupId = url.searchParams.get("intentGroupId");
    const marketId = url.searchParams.get("marketId");
    const activeOnly = url.searchParams.get("activeOnly") !== "false";

    if (!projectId) {
      return jsonError("projectId is required", 400);
    }

    const keywords = await prisma.keyword.findMany({
      where: {
        projectId,
        ...(activeOnly ? { isActive: true } : {}),
        ...(keywordType ? { keywordType } : {}),
        ...(intentGroupId ? { intentGroupId } : {}),
        ...(marketId ? { marketId } : {}),
      },
      include: {
        market: true,
        intentGroup: true,
        keywordSet: true,
        localPair: {
          include: {
            coreKeyword: true,
          },
        },
        corePair: {
          include: {
            localKeyword: true,
          },
        },
      },
      orderBy: [{ keywordType: "asc" }, { text: "asc" }],
    });

    return jsonOk(keywords);
  } catch (error) {
    return jsonError("Failed to fetch keywords", 500, String(error));
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    if (payload.keywords) {
      const parsed = keywordBulkSchema.safeParse(payload);
      if (!parsed.success) {
        return jsonError("Invalid keyword payload", 400, parsed.error.flatten());
      }

      const created = [];

      for (const item of parsed.data.keywords) {
        try {
          const keyword = await prisma.keyword.create({
            data: {
              projectId: parsed.data.projectId,
              text: item.text.trim(),
              normalizedText: normalizeText(item.text),
              keywordType: item.keywordType,
              intentGroupId: item.intentGroupId ?? null,
              marketId: item.marketId ?? null,
              keywordSetId: item.keywordSetId ?? null,
              isPrimaryTarget: item.isPrimaryTarget ?? false,
              notes: item.notes ?? null,
            },
          });

          created.push(keyword);
        } catch (error: unknown) {
          if (
            typeof error === "object" &&
            error &&
            "code" in error &&
            (error as { code?: string }).code === "P2002"
          ) {
            continue;
          }

          throw error;
        }
      }

      return jsonOk({ created: created.length, keywords: created }, { status: 201 });
    }

    const parsed = keywordInputSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonError("Invalid keyword payload", 400, parsed.error.flatten());
    }

    const keyword = await prisma.keyword.create({
      data: {
        projectId: parsed.data.projectId,
        text: parsed.data.text.trim(),
        normalizedText: normalizeText(parsed.data.text),
        keywordType: parsed.data.keywordType,
        intentGroupId: parsed.data.intentGroupId ?? null,
        marketId: parsed.data.marketId ?? null,
        keywordSetId: parsed.data.keywordSetId ?? null,
        isPrimaryTarget: parsed.data.isPrimaryTarget ?? false,
        notes: parsed.data.notes ?? null,
      },
      include: {
        market: true,
        intentGroup: true,
      },
    });

    return jsonOk(keyword, { status: 201 });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return jsonError("Keyword already exists in this project.", 409);
    }

    return jsonError("Failed to create keyword", 500, String(error));
  }
}
