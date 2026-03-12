-- CreateTable
CREATE TABLE "reporting_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "templateType" TEXT NOT NULL,
    "requiredSources" JSONB NOT NULL,
    "supportedMetrics" JSONB NOT NULL,
    "requiredKeywordFields" JSONB NOT NULL,
    "defaultDashboards" JSONB NOT NULL,
    "defaultQAChecks" JSONB NOT NULL,
    "defaultExclusionCategories" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "industry" TEXT,
    "category" TEXT,
    "domain" TEXT NOT NULL,
    "normalizedDomain" TEXT NOT NULL,
    "description" TEXT,
    "templateId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "projects_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "reporting_templates" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "markets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "region" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "markets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "intent_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "intent_groups_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "keyword_sets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "keyword_sets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "keywords" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "keywordSetId" TEXT,
    "marketId" TEXT,
    "intentGroupId" TEXT,
    "text" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "keywordType" TEXT NOT NULL,
    "isPrimaryTarget" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "keywords_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "keywords_keywordSetId_fkey" FOREIGN KEY ("keywordSetId") REFERENCES "keyword_sets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "keywords_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "keywords_intentGroupId_fkey" FOREIGN KEY ("intentGroupId") REFERENCES "intent_groups" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "keyword_pairs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "localKeywordId" TEXT NOT NULL,
    "coreKeywordId" TEXT NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "keyword_pairs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "keyword_pairs_localKeywordId_fkey" FOREIGN KEY ("localKeywordId") REFERENCES "keywords" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "keyword_pairs_coreKeywordId_fkey" FOREIGN KEY ("coreKeywordId") REFERENCES "keywords" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "competitors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "normalizedDomain" TEXT NOT NULL,
    "name" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "competitors_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "import_mapping_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "requiredFields" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "import_mapping_profiles_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "mappingProfileId" TEXT,
    "sourceType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportingMonth" DATETIME NOT NULL,
    "originalHeaders" JSONB,
    "columnMappings" JSONB,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "validRowCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "replaceExisting" BOOLEAN NOT NULL DEFAULT false,
    "summary" JSONB,
    "committedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "import_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "import_jobs_mappingProfileId_fkey" FOREIGN KEY ("mappingProfileId") REFERENCES "import_mapping_profiles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "import_validation_issues" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importJobId" TEXT NOT NULL,
    "rowNumber" INTEGER,
    "field" TEXT,
    "severity" TEXT NOT NULL,
    "code" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "import_validation_issues_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "raw_import_files" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "parsedColumns" JSONB NOT NULL,
    "sizeBytes" INTEGER,
    "mimeType" TEXT,
    "storagePath" TEXT,
    "fileHash" TEXT,
    "rawContent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "raw_import_files_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "raw_import_files_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "raw_import_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importJobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,
    "transformedData" JSONB,
    "issues" JSONB,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "raw_import_records_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "semrush_visibility_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importJobId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "keywordId" TEXT,
    "keywordText" TEXT NOT NULL,
    "normalizedKeyword" TEXT NOT NULL,
    "competitorId" TEXT,
    "competitorDomain" TEXT NOT NULL,
    "normalizedCompetitorDomain" TEXT NOT NULL,
    "visibilityScore" REAL NOT NULL,
    "position" INTEGER,
    "capturedAt" DATETIME NOT NULL,
    "reportingMonth" DATETIME NOT NULL,
    "marketId" TEXT,
    "rankingContext" TEXT,
    "device" TEXT,
    "sourceRowNumber" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "semrush_visibility_records_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "semrush_visibility_records_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "semrush_visibility_records_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "keywords" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "semrush_visibility_records_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "competitors" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "semrush_visibility_records_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "semrush_map_pack_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importJobId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "keywordId" TEXT,
    "keywordText" TEXT NOT NULL,
    "normalizedKeyword" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "normalizedDomain" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "capturedAt" DATETIME NOT NULL,
    "reportingMonth" DATETIME NOT NULL,
    "marketId" TEXT,
    "device" TEXT,
    "sourceRowNumber" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "semrush_map_pack_records_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "semrush_map_pack_records_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "semrush_map_pack_records_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "keywords" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "semrush_map_pack_records_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "semrush_organic_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importJobId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "keywordId" TEXT,
    "keywordText" TEXT NOT NULL,
    "normalizedKeyword" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "normalizedDomain" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "capturedAt" DATETIME NOT NULL,
    "reportingMonth" DATETIME NOT NULL,
    "marketId" TEXT,
    "device" TEXT,
    "searchVolume" INTEGER,
    "sourceRowNumber" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "semrush_organic_records_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "semrush_organic_records_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "semrush_organic_records_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "keywords" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "semrush_organic_records_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gsc_query_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importJobId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "normalizedQuery" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "ctr" REAL,
    "averagePosition" REAL,
    "dateRangeStart" DATETIME,
    "dateRangeEnd" DATETIME,
    "reportingMonth" DATETIME NOT NULL,
    "isBrandExcluded" BOOLEAN NOT NULL DEFAULT false,
    "isPageExcluded" BOOLEAN NOT NULL DEFAULT false,
    "exclusionReasons" JSONB,
    "sourceRowNumber" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gsc_query_records_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "gsc_query_records_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "brand_exclusion_terms" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "normalizedTerm" TEXT NOT NULL,
    "category" TEXT,
    "matchType" TEXT NOT NULL DEFAULT 'CONTAINS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "brand_exclusion_terms_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "page_exclusion_terms" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "normalizedTerm" TEXT NOT NULL,
    "category" TEXT,
    "matchType" TEXT NOT NULL DEFAULT 'CONTAINS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "page_exclusion_terms_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "dashboard_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "reportingMonth" DATETIME NOT NULL,
    "snapshotData" JSONB NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dashboard_snapshots_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "saved_dashboard_views" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "saved_dashboard_views_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "data_health_issues" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "importJobId" TEXT,
    "reportingMonth" DATETIME,
    "issueType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "affectedEntity" TEXT,
    "affectedId" TEXT,
    "metadata" JSONB,
    "resolvedAt" DATETIME,
    "resolvedNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "data_health_issues_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "data_health_issues_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_jobs" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "reporting_templates_slug_key" ON "reporting_templates"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "projects_normalizedDomain_key" ON "projects"("normalizedDomain");

-- CreateIndex
CREATE UNIQUE INDEX "markets_projectId_normalizedName_key" ON "markets"("projectId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "intent_groups_projectId_normalizedName_key" ON "intent_groups"("projectId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "keyword_sets_projectId_name_key" ON "keyword_sets"("projectId", "name");

-- CreateIndex
CREATE INDEX "keywords_projectId_keywordType_idx" ON "keywords"("projectId", "keywordType");

-- CreateIndex
CREATE UNIQUE INDEX "keywords_projectId_normalizedText_keywordType_marketId_key" ON "keywords"("projectId", "normalizedText", "keywordType", "marketId");

-- CreateIndex
CREATE UNIQUE INDEX "keyword_pairs_localKeywordId_key" ON "keyword_pairs"("localKeywordId");

-- CreateIndex
CREATE UNIQUE INDEX "keyword_pairs_coreKeywordId_key" ON "keyword_pairs"("coreKeywordId");

-- CreateIndex
CREATE UNIQUE INDEX "keyword_pairs_projectId_localKeywordId_coreKeywordId_key" ON "keyword_pairs"("projectId", "localKeywordId", "coreKeywordId");

-- CreateIndex
CREATE UNIQUE INDEX "competitors_projectId_normalizedDomain_key" ON "competitors"("projectId", "normalizedDomain");

-- CreateIndex
CREATE UNIQUE INDEX "import_mapping_profiles_projectId_sourceType_name_key" ON "import_mapping_profiles"("projectId", "sourceType", "name");

-- CreateIndex
CREATE INDEX "import_jobs_projectId_sourceType_reportingMonth_idx" ON "import_jobs"("projectId", "sourceType", "reportingMonth");

-- CreateIndex
CREATE INDEX "import_validation_issues_importJobId_severity_idx" ON "import_validation_issues"("importJobId", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "raw_import_files_importJobId_key" ON "raw_import_files"("importJobId");

-- CreateIndex
CREATE INDEX "raw_import_records_importJobId_rowNumber_idx" ON "raw_import_records"("importJobId", "rowNumber");

-- CreateIndex
CREATE INDEX "semrush_visibility_records_projectId_reportingMonth_idx" ON "semrush_visibility_records"("projectId", "reportingMonth");

-- CreateIndex
CREATE INDEX "semrush_visibility_records_projectId_keywordId_reportingMonth_idx" ON "semrush_visibility_records"("projectId", "keywordId", "reportingMonth");

-- CreateIndex
CREATE INDEX "semrush_map_pack_records_projectId_reportingMonth_idx" ON "semrush_map_pack_records"("projectId", "reportingMonth");

-- CreateIndex
CREATE INDEX "semrush_map_pack_records_projectId_keywordId_reportingMonth_idx" ON "semrush_map_pack_records"("projectId", "keywordId", "reportingMonth");

-- CreateIndex
CREATE INDEX "semrush_organic_records_projectId_reportingMonth_idx" ON "semrush_organic_records"("projectId", "reportingMonth");

-- CreateIndex
CREATE INDEX "semrush_organic_records_projectId_keywordId_reportingMonth_idx" ON "semrush_organic_records"("projectId", "keywordId", "reportingMonth");

-- CreateIndex
CREATE INDEX "gsc_query_records_projectId_reportingMonth_idx" ON "gsc_query_records"("projectId", "reportingMonth");

-- CreateIndex
CREATE INDEX "gsc_query_records_projectId_reportingMonth_isBrandExcluded_isPageExcluded_idx" ON "gsc_query_records"("projectId", "reportingMonth", "isBrandExcluded", "isPageExcluded");

-- CreateIndex
CREATE UNIQUE INDEX "brand_exclusion_terms_projectId_normalizedTerm_category_key" ON "brand_exclusion_terms"("projectId", "normalizedTerm", "category");

-- CreateIndex
CREATE UNIQUE INDEX "page_exclusion_terms_projectId_normalizedTerm_category_key" ON "page_exclusion_terms"("projectId", "normalizedTerm", "category");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_snapshots_projectId_reportingMonth_key" ON "dashboard_snapshots"("projectId", "reportingMonth");

-- CreateIndex
CREATE UNIQUE INDEX "saved_dashboard_views_projectId_slug_key" ON "saved_dashboard_views"("projectId", "slug");

-- CreateIndex
CREATE INDEX "data_health_issues_projectId_reportingMonth_status_idx" ON "data_health_issues"("projectId", "reportingMonth", "status");
