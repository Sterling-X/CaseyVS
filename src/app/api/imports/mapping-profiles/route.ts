import { ImportSourceType } from "@prisma/client";
import { z } from "zod";
import { getMappingProfiles } from "@/lib/import/service";
import { jsonError, jsonOk } from "@/lib/api";

const querySchema = z.object({
  projectId: z.string().min(1),
  sourceType: z.nativeEnum(ImportSourceType),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    projectId: url.searchParams.get("projectId"),
    sourceType: url.searchParams.get("sourceType"),
  });

  if (!parsed.success) {
    return jsonError("projectId and sourceType are required", 400, parsed.error.flatten());
  }

  const profiles = await getMappingProfiles(parsed.data.projectId, parsed.data.sourceType);
  return jsonOk(profiles);
}
