import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { templateRegistry } from "../src/lib/templates/registry";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});

const prisma = new PrismaClient({ adapter });

async function clearDatabase() {
  await prisma.dataHealthIssue.deleteMany();
  await prisma.dashboardSnapshot.deleteMany();
  await prisma.gSCSearchAppearanceRecord.deleteMany();
  await prisma.gSCDeviceRecord.deleteMany();
  await prisma.gSCCountryRecord.deleteMany();
  await prisma.gSCPageRecord.deleteMany();
  await prisma.gSCImportMeta.deleteMany();
  await prisma.gSCQueryRecord.deleteMany();
  await prisma.semrushRankingRecord.deleteMany();
  await prisma.semrushOrganicRecord.deleteMany();
  await prisma.semrushMapPackRecord.deleteMany();
  await prisma.semrushVisibilityRecord.deleteMany();
  await prisma.importValidationIssue.deleteMany();
  await prisma.rawImportRecord.deleteMany();
  await prisma.rawImportFile.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.importMappingProfile.deleteMany();
  await prisma.keywordPair.deleteMany();
  await prisma.keyword.deleteMany();
  await prisma.keywordSet.deleteMany();
  await prisma.intentGroup.deleteMany();
  await prisma.competitor.deleteMany();
  await prisma.market.deleteMany();
  await prisma.brandExclusionTerm.deleteMany();
  await prisma.pageExclusionTerm.deleteMany();
  await prisma.savedDashboardView.deleteMany();
  await prisma.project.deleteMany();
  await prisma.reportingTemplate.deleteMany();
}

async function main() {
  await clearDatabase();

  for (const template of templateRegistry) {
    await prisma.reportingTemplate.create({
      data: {
        name: template.name,
        slug: template.key,
        description: template.description,
        templateType: template.templateType,
        requiredSources: template.requiredSources,
        supportedMetrics: template.supportedMetrics,
        requiredKeywordFields: template.requiredKeywordFields,
        defaultDashboards: template.defaultDashboards,
        defaultQAChecks: template.defaultQAChecks,
        defaultExclusionCategories: template.defaultExclusionCategories,
      },
    });
  }

  console.log(`Seed complete: ${templateRegistry.length} template(s), 0 projects, 0 imported rows.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
