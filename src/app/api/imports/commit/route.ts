import { ImportSourceType } from "@prisma/client";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { parseUploadFile } from "@/lib/import/file-parser";
import { transformSemrushOverviewIfApplicable } from "@/lib/import/semrush-overview";
import { commitGscZipImport, commitImportJob, commitSemrushOverviewImport } from "@/lib/import/service";
import { monthStart } from "@/lib/utils";

const requestSchema = z.object({
  projectId: z.string().min(1),
  sourceType: z.nativeEnum(ImportSourceType),
  reportingMonth: z.string().regex(/^\d{4}-\d{2}$/),
  mapping: z.record(z.string()).optional(),
  mappingProfileId: z.string().optional(),
  saveMappingProfileName: z.string().optional(),
  replaceExisting: z
    .union([z.string(), z.boolean()])
    .transform((value) => value === true || value === "true")
    .optional(),
});

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return jsonError("file is required", 400);
    }

    const parsedPayload = requestSchema.safeParse({
      projectId: form.get("projectId"),
      sourceType: form.get("sourceType"),
      reportingMonth: form.get("reportingMonth"),
      mapping: form.get("mapping") ? JSON.parse(String(form.get("mapping"))) : undefined,
      mappingProfileId: form.get("mappingProfileId") ?? undefined,
      saveMappingProfileName: form.get("saveMappingProfileName") ?? undefined,
      replaceExisting: form.get("replaceExisting") ?? false,
    });

    if (!parsedPayload.success) {
      return jsonError("Invalid import payload", 400, parsedPayload.error.flatten());
    }

    const reportingMonth = monthStart(parsedPayload.data.reportingMonth);

    if (parsedPayload.data.sourceType === ImportSourceType.GSC_PERFORMANCE_ZIP) {
      const zipBuffer = Buffer.from(await file.arrayBuffer());
      const result = await commitGscZipImport({
        projectId: parsedPayload.data.projectId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        uploadDate: new Date(),
        reportingMonth,
        zipBuffer,
        replaceExisting: parsedPayload.data.replaceExisting ?? false,
      });

      return jsonOk({
        committed: result.committed,
        importJobId: result.importJob.id,
        status: result.importJob.status,
        issueSummary: {
          errorCount: result.preview.issues.filter((issue) => issue.severity === "ERROR").length,
          warningCount: result.preview.issues.filter((issue) => issue.severity === "WARNING").length,
        },
        previewRows: result.preview.queries.slice(0, 20).map((row) => ({
          query: row.dimension,
          currentClicks: row.currentClicks,
          previousClicks: row.previousClicks,
          currentImpressions: row.currentImpressions,
          previousImpressions: row.previousImpressions,
        })),
        issues: result.preview.issues,
      });
    }

    const parsedFile = await parseUploadFile(file);

    if (parsedPayload.data.sourceType === ImportSourceType.SEMRUSH_RANKINGS_OVERVIEW) {
      const rawContent = file.name.toLowerCase().endsWith(".csv")
        ? Buffer.from(await file.arrayBuffer()).toString("utf8")
        : undefined;
      const result = await commitSemrushOverviewImport({
        projectId: parsedPayload.data.projectId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        rawContent,
        uploadDate: new Date(),
        reportingMonth,
        parsed: parsedFile,
        replaceExisting: parsedPayload.data.replaceExisting ?? false,
      });

      return jsonOk({
        committed: result.committed,
        importJobId: result.importJob.id,
        status: result.importJob.status,
        issueSummary: {
          errorCount: result.preview.issues.filter((issue) => issue.severity === "ERROR").length,
          warningCount: result.preview.issues.filter((issue) => issue.severity === "WARNING").length,
        },
        previewRows: result.preview.rows.slice(0, 20),
        issues: result.preview.issues,
      });
    }

    const normalizedFile = transformSemrushOverviewIfApplicable(
      parsedPayload.data.sourceType,
      parsedFile,
      reportingMonth,
    );
    const rawContent = file.name.toLowerCase().endsWith(".csv")
      ? Buffer.from(await file.arrayBuffer()).toString("utf8")
      : undefined;

    if (!parsedPayload.data.mapping) {
      return jsonError("mapping is required for this source type", 400);
    }

    const result = await commitImportJob({
      projectId: parsedPayload.data.projectId,
      sourceType: parsedPayload.data.sourceType,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      rawContent,
      uploadDate: new Date(),
      reportingMonth,
      parsed: normalizedFile,
      mapping: parsedPayload.data.mapping,
      mappingProfileId: parsedPayload.data.mappingProfileId,
      replaceExisting: parsedPayload.data.replaceExisting ?? false,
      saveMappingProfileName: parsedPayload.data.saveMappingProfileName,
    });

    return jsonOk({
      committed: result.committed,
      importJobId: result.importJob.id,
      status: result.importJob.status,
      issueSummary: {
        errorCount: result.preview.issues.filter((issue) => issue.severity === "ERROR").length,
        warningCount: result.preview.issues.filter((issue) => issue.severity === "WARNING").length,
      },
      previewRows: result.preview.rows.slice(0, 20),
      issues: result.preview.issues,
    });
  } catch (error) {
    return jsonError("Failed to commit import", 500, String(error));
  }
}
