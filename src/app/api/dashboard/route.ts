import { KeywordType } from "@prisma/client";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { getDashboardPayload } from "@/lib/dashboard/service";
import { monthStart } from "@/lib/utils";

const querySchema = z.object({
  projectId: z.string().min(1),
  reportingMonth: z.string().regex(/^\d{4}-\d{2}$/),
  marketId: z.string().optional(),
  keywordType: z.nativeEnum(KeywordType).optional(),
  intentGroupId: z.string().optional(),
  competitorId: z.string().optional(),
  primaryTargetOnly: z
    .string()
    .optional()
    .transform((value) => (value ? value === "true" : false)),
  activeOnly: z
    .string()
    .optional()
    .transform((value) => (value ? value !== "false" : true)),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const parsed = querySchema.safeParse({
      projectId: url.searchParams.get("projectId"),
      reportingMonth: url.searchParams.get("reportingMonth"),
      marketId: url.searchParams.get("marketId") || undefined,
      keywordType: (url.searchParams.get("keywordType") as KeywordType | null) || undefined,
      intentGroupId: url.searchParams.get("intentGroupId") || undefined,
      competitorId: url.searchParams.get("competitorId") || undefined,
      primaryTargetOnly: url.searchParams.get("primaryTargetOnly") || undefined,
      activeOnly: url.searchParams.get("activeOnly") || undefined,
    });

    if (!parsed.success) {
      return jsonError("Invalid dashboard query", 400, parsed.error.flatten());
    }

    const payload = await getDashboardPayload(parsed.data.projectId, monthStart(parsed.data.reportingMonth), {
      marketId: parsed.data.marketId,
      keywordType: parsed.data.keywordType,
      intentGroupId: parsed.data.intentGroupId,
      competitorId: parsed.data.competitorId,
      primaryTargetOnly: parsed.data.primaryTargetOnly,
      activeOnly: parsed.data.activeOnly,
    });

    return jsonOk(payload);
  } catch (error) {
    return jsonError("Failed to load dashboard", 500, String(error));
  }
}
