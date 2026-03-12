import { z } from "zod";
import { parseDate, parseInteger, parseNumber } from "@/lib/utils";

const nonEmptyString = z.string().trim().min(1, "Required field");

const dateString = z
  .string()
  .trim()
  .refine((value) => parseDate(value) !== null, "Invalid date");

const requiredNumber = z
  .union([z.string(), z.number()])
  .transform((value) => parseNumber(value))
  .refine((value): value is number => value !== null, "Required number");

const requiredInt = z
  .union([z.string(), z.number()])
  .transform((value) => parseInteger(value))
  .refine((value): value is number => value !== null, "Required integer");

const optionalInt = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => parseInteger(value))
  .optional();

const optionalNum = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => parseNumber(value))
  .optional();

export const semrushVisibilitySchema = z.object({
  keyword: nonEmptyString,
  competitorDomain: nonEmptyString,
  visibilityScore: requiredNumber,
  capturedAt: dateString,
  market: z.string().trim().optional(),
  position: optionalInt,
  rankingContext: z.string().trim().optional(),
  device: z.string().trim().optional(),
});

export const semrushMapPackSchema = z.object({
  keyword: nonEmptyString,
  domain: nonEmptyString,
  position: requiredInt,
  capturedAt: dateString,
  market: z.string().trim().optional(),
  device: z.string().trim().optional(),
});

export const semrushOrganicSchema = z.object({
  keyword: nonEmptyString,
  domain: nonEmptyString,
  position: requiredInt,
  capturedAt: dateString,
  market: z.string().trim().optional(),
  device: z.string().trim().optional(),
  searchVolume: optionalInt,
});

export const gscQuerySchema = z.object({
  query: nonEmptyString,
  clicks: requiredInt,
  impressions: requiredInt,
  ctr: requiredNumber,
  averagePosition: requiredNumber,
  dateRangeStart: dateString,
  dateRangeEnd: dateString,
});

export const semrushOverviewSchema = z.object({
  keyword: nonEmptyString,
  domain: nonEmptyString,
  capturedAt: dateString,
  rank: optionalInt.nullish(),
  rankingType: z.string().trim().optional().nullable(),
  landingUrl: z.string().trim().optional().nullable(),
  difference: optionalNum.nullish(),
  tags: z.string().trim().optional().nullable(),
  intents: z.string().trim().optional().nullable(),
  searchVolume: optionalInt.nullish(),
  cpc: optionalNum.nullish(),
  keywordDifficulty: optionalNum.nullish(),
});
