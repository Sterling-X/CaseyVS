import { ImportSourceType } from "@prisma/client";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { parseUploadFile } from "@/lib/import/file-parser";
import {
  buildPreview,
  detectDefaultMapping,
  previewGscZipImport,
  previewSemrushOverviewImport,
} from "@/lib/import/service";
import { transformSemrushOverviewIfApplicable } from "@/lib/import/semrush-overview";
import { getSourceDefinition } from "@/lib/import/source-definitions";
import { monthStart } from "@/lib/utils";

const requestSchema = z.object({
  projectId: z.string().min(1),
  sourceType: z.nativeEnum(ImportSourceType),
  reportingMonth: z.string().regex(/^\d{4}-\d{2}$/),
  mapping: z.record(z.string()).optional(),
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
    });

    if (!parsedPayload.success) {
      return jsonError("Invalid preview payload", 400, parsedPayload.error.flatten());
    }

    if (parsedPayload.data.sourceType === ImportSourceType.GSC_PERFORMANCE_ZIP) {
      const zipPreview = await previewGscZipImport(file);
      const previewRows = zipPreview.queries.slice(0, 30).map((row) => ({
        query: row.dimension,
        currentClicks: row.currentClicks,
        previousClicks: row.previousClicks,
        currentImpressions: row.currentImpressions,
        previousImpressions: row.previousImpressions,
        currentCtr: row.currentCtr,
        previousCtr: row.previousCtr,
        currentPosition: row.currentPosition,
        previousPosition: row.previousPosition,
      }));

      return jsonOk({
        sourceType: parsedPayload.data.sourceType,
        reportingMonth: parsedPayload.data.reportingMonth,
        file: {
          name: file.name,
          size: file.size,
          type: file.type,
        },
        headers: [
          "query",
          "currentClicks",
          "previousClicks",
          "currentImpressions",
          "previousImpressions",
          "currentCtr",
          "previousCtr",
          "currentPosition",
          "previousPosition",
        ],
        rowCount:
          zipPreview.queries.length +
          zipPreview.pages.length +
          zipPreview.countries.length +
          zipPreview.devices.length +
          zipPreview.appearances.length,
        requiredFields: getSourceDefinition(parsedPayload.data.sourceType).requiredFields,
        mapping: {},
        previewRows,
        gscComponents: zipPreview.filePresence,
        gscMeta: zipPreview.importMeta,
        issues: zipPreview.issues,
        issueSummary: {
          errorCount: zipPreview.issues.filter((item) => item.severity === "ERROR").length,
          warningCount: zipPreview.issues.filter((item) => item.severity === "WARNING").length,
        },
      });
    }

    const parsedFile = await parseUploadFile(file);

    if (parsedPayload.data.sourceType === ImportSourceType.SEMRUSH_RANKINGS_OVERVIEW) {
      const overviewPreview = previewSemrushOverviewImport(parsedFile);
      const previewRows = overviewPreview.rows.slice(0, 30);
      return jsonOk({
        sourceType: parsedPayload.data.sourceType,
        reportingMonth: parsedPayload.data.reportingMonth,
        file: {
          name: file.name,
          size: file.size,
          type: file.type,
        },
        headers: Object.keys(previewRows[0] ?? {
          keyword: "",
          tags: "",
          intents: "",
          domain: "",
          capturedAt: "",
          rank: "",
          rankingType: "",
          landingUrl: "",
          difference: "",
          searchVolume: "",
          cpc: "",
          keywordDifficulty: "",
        }),
        rowCount: overviewPreview.rows.length,
        requiredFields: getSourceDefinition(parsedPayload.data.sourceType).requiredFields,
        mapping: {
          keyword: "keyword",
          domain: "domain",
          capturedAt: "capturedAt",
          rank: "rank",
          rankingType: "rankingType",
          landingUrl: "landingUrl",
          difference: "difference",
          tags: "tags",
          intents: "intents",
          searchVolume: "searchVolume",
          cpc: "cpc",
          keywordDifficulty: "keywordDifficulty",
        },
        previewRows,
        detectedDomains: overviewPreview.detectedDomains,
        detectedDates: overviewPreview.detectedDates,
        issues: overviewPreview.issues,
        issueSummary: {
          errorCount: overviewPreview.issues.filter((item) => item.severity === "ERROR").length,
          warningCount: overviewPreview.issues.filter((item) => item.severity === "WARNING").length,
        },
      });
    }

    const normalizedFile = transformSemrushOverviewIfApplicable(
      parsedPayload.data.sourceType,
      parsedFile,
      monthStart(parsedPayload.data.reportingMonth),
    );
    const mapping = parsedPayload.data.mapping ?? detectDefaultMapping(parsedPayload.data.sourceType, normalizedFile);
    const preview = buildPreview(parsedPayload.data.sourceType, normalizedFile, mapping);

    return jsonOk({
      sourceType: parsedPayload.data.sourceType,
      reportingMonth: parsedPayload.data.reportingMonth,
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
      },
      headers: normalizedFile.headers,
      rowCount: normalizedFile.rows.length,
      requiredFields: getSourceDefinition(parsedPayload.data.sourceType).requiredFields,
      mapping,
      previewRows: preview.rows.slice(0, 30),
      issues: preview.issues,
      issueSummary: {
        errorCount: preview.issues.filter((item) => item.severity === "ERROR").length,
        warningCount: preview.issues.filter((item) => item.severity === "WARNING").length,
      },
    });
  } catch (error) {
    return jsonError("Failed to preview import", 500, String(error));
  }
}
