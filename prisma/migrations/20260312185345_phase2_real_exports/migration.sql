-- CreateTable
CREATE TABLE "semrush_ranking_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importJobId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "keywordId" TEXT,
    "marketId" TEXT,
    "keywordText" TEXT NOT NULL,
    "normalizedKeyword" TEXT NOT NULL,
    "tags" TEXT,
    "intents" TEXT,
    "domain" TEXT NOT NULL,
    "normalizedDomain" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL,
    "reportingMonth" DATETIME NOT NULL,
    "rank" INTEGER,
    "rankingType" TEXT,
    "landingUrl" TEXT,
    "difference" REAL,
    "searchVolume" INTEGER,
    "cpc" REAL,
    "keywordDifficulty" REAL,
    "sourceRowNumber" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "semrush_ranking_records_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "semrush_ranking_records_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "semrush_ranking_records_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "keywords" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "semrush_ranking_records_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gsc_import_meta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importJobId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportingMonth" DATETIME NOT NULL,
    "searchType" TEXT,
    "dateRangeLabel" TEXT,
    "currentRangeLabel" TEXT,
    "previousRangeLabel" TEXT,
    "appliedFilters" JSONB,
    "rawFilters" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gsc_import_meta_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "gsc_import_meta_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gsc_page_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importJobId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportingMonth" DATETIME NOT NULL,
    "page" TEXT NOT NULL,
    "normalizedPage" TEXT NOT NULL,
    "currentClicks" INTEGER NOT NULL DEFAULT 0,
    "previousClicks" INTEGER NOT NULL DEFAULT 0,
    "currentImpressions" INTEGER NOT NULL DEFAULT 0,
    "previousImpressions" INTEGER NOT NULL DEFAULT 0,
    "currentCtr" REAL,
    "previousCtr" REAL,
    "currentPosition" REAL,
    "previousPosition" REAL,
    "sourceRowNumber" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gsc_page_records_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "gsc_page_records_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gsc_country_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importJobId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportingMonth" DATETIME NOT NULL,
    "country" TEXT NOT NULL,
    "normalizedCountry" TEXT NOT NULL,
    "currentClicks" INTEGER NOT NULL DEFAULT 0,
    "previousClicks" INTEGER NOT NULL DEFAULT 0,
    "currentImpressions" INTEGER NOT NULL DEFAULT 0,
    "previousImpressions" INTEGER NOT NULL DEFAULT 0,
    "currentCtr" REAL,
    "previousCtr" REAL,
    "currentPosition" REAL,
    "previousPosition" REAL,
    "sourceRowNumber" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gsc_country_records_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "gsc_country_records_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gsc_device_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importJobId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportingMonth" DATETIME NOT NULL,
    "device" TEXT NOT NULL,
    "normalizedDevice" TEXT NOT NULL,
    "currentClicks" INTEGER NOT NULL DEFAULT 0,
    "previousClicks" INTEGER NOT NULL DEFAULT 0,
    "currentImpressions" INTEGER NOT NULL DEFAULT 0,
    "previousImpressions" INTEGER NOT NULL DEFAULT 0,
    "currentCtr" REAL,
    "previousCtr" REAL,
    "currentPosition" REAL,
    "previousPosition" REAL,
    "sourceRowNumber" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gsc_device_records_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "gsc_device_records_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gsc_search_appearance_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importJobId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportingMonth" DATETIME NOT NULL,
    "appearance" TEXT NOT NULL,
    "normalizedAppearance" TEXT NOT NULL,
    "currentClicks" INTEGER NOT NULL DEFAULT 0,
    "previousClicks" INTEGER NOT NULL DEFAULT 0,
    "currentImpressions" INTEGER NOT NULL DEFAULT 0,
    "previousImpressions" INTEGER NOT NULL DEFAULT 0,
    "currentCtr" REAL,
    "previousCtr" REAL,
    "currentPosition" REAL,
    "previousPosition" REAL,
    "sourceRowNumber" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gsc_search_appearance_records_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "gsc_search_appearance_records_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_gsc_query_records" (
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
    "currentClicks" INTEGER NOT NULL DEFAULT 0,
    "previousClicks" INTEGER NOT NULL DEFAULT 0,
    "currentImpressions" INTEGER NOT NULL DEFAULT 0,
    "previousImpressions" INTEGER NOT NULL DEFAULT 0,
    "currentCtr" REAL,
    "previousCtr" REAL,
    "currentPosition" REAL,
    "previousPosition" REAL,
    "exclusionStatus" TEXT,
    "exclusionReasonText" TEXT,
    CONSTRAINT "gsc_query_records_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "gsc_query_records_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_gsc_query_records" ("averagePosition", "clicks", "createdAt", "ctr", "dateRangeEnd", "dateRangeStart", "exclusionReasons", "id", "importJobId", "impressions", "isBrandExcluded", "isPageExcluded", "normalizedQuery", "projectId", "query", "reportingMonth", "sourceRowNumber") SELECT "averagePosition", "clicks", "createdAt", "ctr", "dateRangeEnd", "dateRangeStart", "exclusionReasons", "id", "importJobId", "impressions", "isBrandExcluded", "isPageExcluded", "normalizedQuery", "projectId", "query", "reportingMonth", "sourceRowNumber" FROM "gsc_query_records";
DROP TABLE "gsc_query_records";
ALTER TABLE "new_gsc_query_records" RENAME TO "gsc_query_records";
CREATE INDEX "gsc_query_records_projectId_reportingMonth_idx" ON "gsc_query_records"("projectId", "reportingMonth");
CREATE INDEX "gsc_query_records_projectId_reportingMonth_isBrandExcluded_isPageExcluded_idx" ON "gsc_query_records"("projectId", "reportingMonth", "isBrandExcluded", "isPageExcluded");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "semrush_ranking_records_projectId_reportingMonth_idx" ON "semrush_ranking_records"("projectId", "reportingMonth");

-- CreateIndex
CREATE INDEX "semrush_ranking_records_projectId_normalizedDomain_reportingMonth_idx" ON "semrush_ranking_records"("projectId", "normalizedDomain", "reportingMonth");

-- CreateIndex
CREATE INDEX "semrush_ranking_records_projectId_keywordId_reportingMonth_idx" ON "semrush_ranking_records"("projectId", "keywordId", "reportingMonth");

-- CreateIndex
CREATE UNIQUE INDEX "gsc_import_meta_importJobId_key" ON "gsc_import_meta"("importJobId");

-- CreateIndex
CREATE INDEX "gsc_import_meta_projectId_reportingMonth_idx" ON "gsc_import_meta"("projectId", "reportingMonth");

-- CreateIndex
CREATE INDEX "gsc_page_records_projectId_reportingMonth_idx" ON "gsc_page_records"("projectId", "reportingMonth");

-- CreateIndex
CREATE INDEX "gsc_country_records_projectId_reportingMonth_idx" ON "gsc_country_records"("projectId", "reportingMonth");

-- CreateIndex
CREATE INDEX "gsc_device_records_projectId_reportingMonth_idx" ON "gsc_device_records"("projectId", "reportingMonth");

-- CreateIndex
CREATE INDEX "gsc_search_appearance_records_projectId_reportingMonth_idx" ON "gsc_search_appearance_records"("projectId", "reportingMonth");
