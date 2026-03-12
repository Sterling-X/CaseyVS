import prisma from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";

export async function GET() {
  try {
    const templates = await prisma.reportingTemplate.findMany({
      orderBy: { createdAt: "asc" },
    });

    return jsonOk(templates);
  } catch (error) {
    return jsonError("Failed to fetch templates", 500, String(error));
  }
}
