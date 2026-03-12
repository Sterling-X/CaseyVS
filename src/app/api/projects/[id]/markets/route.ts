import { z } from "zod";
import prisma from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { normalizeText } from "@/lib/utils";

const createMarketSchema = z.object({
  name: z.string().min(1),
  region: z.string().optional(),
});

export async function GET(_request: Request, context: { params: { id: string } }) {
  try {
    const markets = await prisma.market.findMany({
      where: { projectId: context.params.id, isActive: true },
      orderBy: { name: "asc" },
    });

    return jsonOk(markets);
  } catch (error) {
    return jsonError("Failed to fetch markets", 500, String(error));
  }
}

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const payload = await request.json();
    const parsed = createMarketSchema.safeParse(payload);

    if (!parsed.success) {
      return jsonError("Invalid market payload", 400, parsed.error.flatten());
    }

    const market = await prisma.market.create({
      data: {
        projectId: context.params.id,
        name: parsed.data.name.trim(),
        normalizedName: normalizeText(parsed.data.name),
        region: parsed.data.region?.trim() || null,
      },
    });

    return jsonOk(market, { status: 201 });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return jsonError("Market already exists for this project.", 409);
    }

    return jsonError("Failed to create market", 500, String(error));
  }
}
