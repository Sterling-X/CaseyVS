import { z } from "zod";
import prisma from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { runQaForProjectMonth, summarizeQa } from "@/lib/qa/engine";
import { monthStart } from "@/lib/utils";

const querySchema = z.object({
  projectId: z.string().min(1),
  reportingMonth: z.string().regex(/^\d{4}-\d{2}$/),
  run: z
    .string()
    .optional()
    .transform((value) => value === "true"),
});

const resolveSchema = z.object({
  issueId: z.string().min(1),
  status: z.enum(["OPEN", "RESOLVED", "IGNORED"]),
  resolvedNote: z.string().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    projectId: url.searchParams.get("projectId"),
    reportingMonth: url.searchParams.get("reportingMonth"),
    run: url.searchParams.get("run") || undefined,
  });

  if (!parsed.success) {
    return jsonError("projectId and reportingMonth are required", 400, parsed.error.flatten());
  }

  const reportingMonth = monthStart(parsed.data.reportingMonth);

  if (parsed.data.run) {
    await runQaForProjectMonth(parsed.data.projectId, reportingMonth);
  }

  const issues = await prisma.dataHealthIssue.findMany({
    where: {
      projectId: parsed.data.projectId,
      reportingMonth,
    },
    orderBy: [{ status: "asc" }, { severity: "desc" }, { createdAt: "desc" }],
  });

  const summary = await summarizeQa(parsed.data.projectId, reportingMonth);
  return jsonOk({ summary, issues });
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json();
    const parsed = resolveSchema.safeParse(payload);

    if (!parsed.success) {
      return jsonError("Invalid QA issue payload", 400, parsed.error.flatten());
    }

    const issue = await prisma.dataHealthIssue.update({
      where: { id: parsed.data.issueId },
      data: {
        status: parsed.data.status,
        resolvedAt: parsed.data.status === "RESOLVED" ? new Date() : null,
        resolvedNote: parsed.data.resolvedNote ?? null,
      },
    });

    return jsonOk(issue);
  } catch (error) {
    return jsonError("Failed to update QA issue", 500, String(error));
  }
}
