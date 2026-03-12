import { ImportSourceType, TemplateType } from "@prisma/client";

export type TemplateDefinition = {
  key: string;
  name: string;
  description: string;
  templateType: TemplateType;
  requiredSources: ImportSourceType[];
  supportedMetrics: string[];
  requiredKeywordFields: string[];
  defaultDashboards: string[];
  defaultQAChecks: string[];
  defaultExclusionCategories: string[];
};

export const FAMILY_LAW_TEMPLATE_KEY = "family-law-seo-visibility";

export const templateRegistry: TemplateDefinition[] = [
  {
    key: FAMILY_LAW_TEMPLATE_KEY,
    name: "Family Law SEO Visibility Template",
    description:
      "Monthly visibility framework for family law firms with explicit local/core pairing and exclusion-driven GSC reporting.",
    templateType: TemplateType.SEO_VISIBILITY,
    requiredSources: [
      ImportSourceType.SEMRUSH_RANKINGS_OVERVIEW,
      ImportSourceType.GSC_PERFORMANCE_ZIP,
    ],
    supportedMetrics: [
      "solv",
      "map_pack_average_rank",
      "organic_average_rank",
      "gsc_total_clicks",
      "gsc_non_brand_clicks",
      "gsc_non_brand_non_page_clicks",
    ],
    requiredKeywordFields: ["text", "keywordType", "intentGroup", "market"],
    defaultDashboards: [
      "executive_overview",
      "competitor_solv",
      "map_pack",
      "organic",
      "gsc",
      "keyword_pairs",
      "qa",
    ],
    defaultQAChecks: [
      "unmapped_keywords",
      "missing_required_fields",
      "duplicate_keywords",
      "missing_competitor_mapping",
      "missing_market",
      "incomplete_local_core_pairs",
      "date_inconsistency",
      "empty_import",
      "unknown_project_keywords",
      "branded_query_missed",
      "rank_outlier",
    ],
    defaultExclusionCategories: ["brand", "page_specific"],
  },
];
