import { z } from "zod";
import { toInt, toNumber } from "@/lib/utils";

const nonEmptyString = z.string().trim().min(1);

const dateString = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date value");

export const semrushVisibilitySchema = z.object({
  keyword: nonEmptyString,
  competitorDomain: nonEmptyString,
  visibilityScore: z
    .union([z.string(), z.number()])
    .transform((value) => toNumber(value))
    .refine((value): value is number => value !== null, "Visibility score is required"),
  capturedAt: dateString,
  market: z.string().trim().optional(),
  position: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((value) => toInt(value ?? null))
    .optional(),
  rankingContext: z.string().trim().optional(),
  device: z.string().trim().optional(),
});

export const semrushMapPackSchema = z.object({
  keyword: nonEmptyString,
  domain: nonEmptyString,
  position: z
    .union([z.string(), z.number()])
    .transform((value) => toInt(value))
    .refine((value): value is number => value !== null, "Position is required"),
  capturedAt: dateString,
  market: z.string().trim().optional(),
  device: z.string().trim().optional(),
});

export const semrushOrganicSchema = semrushMapPackSchema;

export const gscQuerySchema = z.object({
  query: nonEmptyString,
  clicks: z
    .union([z.string(), z.number()])
    .transform((value) => toInt(value))
    .refine((value): value is number => value !== null, "Clicks is required"),
  impressions: z
    .union([z.string(), z.number()])
    .transform((value) => toInt(value))
    .refine((value): value is number => value !== null, "Impressions is required"),
  ctr: z
    .union([z.string(), z.number()])
    .transform((value) => {
      const normalized = typeof value === "string" && value.trim().endsWith("%")
        ? String(toNumber(value))
        : value;
      return toNumber(normalized);
    })
    .refine((value): value is number => value !== null, "CTR is required"),
  averagePosition: z
    .union([z.string(), z.number()])
    .transform((value) => toNumber(value))
    .refine((value): value is number => value !== null, "Average position is required"),
  dateRangeStart: dateString,
  dateRangeEnd: dateString,
});

export type SemrushVisibilityRow = z.infer<typeof semrushVisibilitySchema>;
export type SemrushMapPackRow = z.infer<typeof semrushMapPackSchema>;
export type SemrushOrganicRow = z.infer<typeof semrushOrganicSchema>;
export type GscQueryRow = z.infer<typeof gscQuerySchema>;
