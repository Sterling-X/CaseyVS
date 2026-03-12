import { KeywordType } from "@prisma/client";
import { z } from "zod";
import { getDashboardPayload } from "@/lib/dashboard/service";
import { jsonError } from "@/lib/api";
import { monthStart } from "@/lib/utils";
import { buildDashboardPdf } from "@/lib/reports/pdf";

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

function safeFileName(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

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
      return jsonError("Invalid PDF export query", 400, parsed.error.flatten());
    }

    const payload = await getDashboardPayload(parsed.data.projectId, monthStart(parsed.data.reportingMonth), {
      marketId: parsed.data.marketId,
      keywordType: parsed.data.keywordType,
      intentGroupId: parsed.data.intentGroupId,
      competitorId: parsed.data.competitorId,
      primaryTargetOnly: parsed.data.primaryTargetOnly,
      activeOnly: parsed.data.activeOnly,
    });

    const pdf = await buildDashboardPdf(payload);
    const fileName = `${safeFileName(payload.project.name || "report")}-${payload.month}.pdf`;
    const body = Uint8Array.from(pdf);

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${fileName}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return jsonError("Failed to export PDF", 500, String(error));
  }
}
