import type { PrismaClient } from '@prisma/client'
import type { QAIssueType, QASeverity } from '@/types'

interface QAIssueInput {
  projectId: string
  importJobId?: string
  issueType: QAIssueType
  severity: QASeverity
  description: string
  affectedEntity?: string
  affectedId?: string
  reportingMonth?: string
}

export async function runImportQAChecks(
  prisma: PrismaClient,
  importJobId: string,
  projectId: string,
  reportingMonth: string
): Promise<void> {
  const issues: QAIssueInput[] = []

  const importJob = await prisma.importJob.findUnique({
    where: { id: importJobId },
    include: {
      visibilityRecords: true,
      mapPackRecords: true,
      organicRecords: true,
      gscRecords: true,
    },
  })

  if (!importJob) return

  const projectKeywords = await prisma.keyword.findMany({
    where: { projectId, isActive: true },
    select: { text: true, keywordType: true, pairId: true, id: true },
  })

  const projectKeywordTexts = new Set(projectKeywords.map(k => k.text.toLowerCase()))

  // Check 1: Empty import
  const totalRecords =
    importJob.visibilityRecords.length +
    importJob.mapPackRecords.length +
    importJob.organicRecords.length +
    importJob.gscRecords.length

  if (totalRecords === 0) {
    issues.push({
      projectId,
      importJobId,
      issueType: 'EMPTY_IMPORT',
      severity: 'ERROR',
      description: `Import job ${importJobId} contains no records after processing.`,
      reportingMonth,
    })
  }

  // Check 2: Keywords in import not found in project keyword set
  const importedKeywords = new Set<string>()
  ;[
    ...importJob.visibilityRecords.map(r => r.keyword),
    ...importJob.mapPackRecords.map(r => r.keyword),
    ...importJob.organicRecords.map(r => r.keyword),
  ].forEach(k => importedKeywords.add(k.toLowerCase()))

  const unmappedKeywords = [...importedKeywords].filter(k => !projectKeywordTexts.has(k))
  if (unmappedKeywords.length > 0) {
    const sample = unmappedKeywords.slice(0, 5).join(', ')
    const more = unmappedKeywords.length > 5 ? ` (+${unmappedKeywords.length - 5} more)` : ''
    issues.push({
      projectId,
      importJobId,
      issueType: 'KEYWORD_NOT_IN_PROJECT_SET',
      severity: 'WARNING',
      description: `${unmappedKeywords.length} keyword(s) in the import are not in the project keyword set: ${sample}${more}`,
      reportingMonth,
    })
  }

  // Check 3: Check for keywords missing market values where other records have markets
  if (importJob.sourceType !== 'GSC_QUERIES') {
    const allRecords = [
      ...importJob.mapPackRecords,
      ...importJob.organicRecords,
      ...importJob.visibilityRecords,
    ]
    const withMarket = allRecords.filter(r => r.market && r.market.length > 0).length
    const withoutMarket = allRecords.filter(r => !r.market || r.market.length === 0).length
    if (withMarket > 0 && withoutMarket > 0) {
      issues.push({
        projectId,
        importJobId,
        issueType: 'MISSING_MARKET_VALUE',
        severity: 'WARNING',
        description: `${withoutMarket} records are missing market values while ${withMarket} records have them. Check if market column was mapped correctly.`,
        reportingMonth,
      })
    }
  }

  // Check 4: GSC branded query detection
  if (importJob.sourceType === 'GSC_QUERIES') {
    const brandExclusions = await prisma.brandExclusionTerm.findMany({
      where: { projectId },
    })
    const potentiallyBrandedUnexcluded = importJob.gscRecords.filter(r => {
      const query = r.query.toLowerCase()
      const isExcluded = r.isBranded === true
      if (isExcluded) return false
      // Heuristic: look for common branded patterns not caught by exclusions
      return brandExclusions.some(e => {
        const term = e.term.toLowerCase()
        return query.includes(term) && r.isBranded !== true
      })
    })
    if (potentiallyBrandedUnexcluded.length > 0) {
      issues.push({
        projectId,
        importJobId,
        issueType: 'UNDETECTED_BRANDED_QUERY',
        severity: 'WARNING',
        description: `${potentiallyBrandedUnexcluded.length} GSC queries may be branded but were not caught by exclusion rules. Review exclusion terms.`,
        reportingMonth,
      })
    }
  }

  // Check 5: Incomplete local/core keyword pairs
  const localKeywords = projectKeywords.filter(k => k.keywordType === 'LOCAL')
  const coreKeywords = projectKeywords.filter(k => k.keywordType === 'CORE')
  const unpaired = [
    ...localKeywords.filter(k => !k.pairId),
    ...coreKeywords.filter(k => !k.pairId),
  ]
  if (unpaired.length > 0) {
    issues.push({
      projectId,
      importJobId: undefined,
      issueType: 'INCOMPLETE_KEYWORD_PAIR',
      severity: 'INFO',
      description: `${unpaired.length} keyword(s) are missing a local/core pair relationship.`,
      reportingMonth,
    })
  }

  // Save all issues
  if (issues.length > 0) {
    await prisma.qAIssue.createMany({
      data: issues.map(issue => ({
        projectId: issue.projectId,
        importJobId: issue.importJobId ?? null,
        issueType: issue.issueType,
        severity: issue.severity,
        description: issue.description,
        affectedEntity: issue.affectedEntity ?? null,
        affectedId: issue.affectedId ?? null,
        reportingMonth: issue.reportingMonth ?? null,
      })),
    })
  }
}

export async function runProjectHealthChecks(
  prisma: PrismaClient,
  projectId: string
): Promise<number> {
  const issues: QAIssueInput[] = []

  const keywords = await prisma.keyword.findMany({
    where: { projectId, isActive: true },
  })

  // Check duplicate keywords
  const keywordTextCounts: Record<string, number> = {}
  for (const kw of keywords) {
    const normalized = kw.text.toLowerCase().trim()
    keywordTextCounts[normalized] = (keywordTextCounts[normalized] ?? 0) + 1
  }
  const duplicates = Object.entries(keywordTextCounts).filter(([, count]) => count > 1)
  if (duplicates.length > 0) {
    issues.push({
      projectId,
      issueType: 'DUPLICATE_KEYWORD',
      severity: 'ERROR',
      description: `${duplicates.length} duplicate keyword text(s) found: ${duplicates.map(([t]) => t).slice(0, 3).join(', ')}...`,
    })
  }

  // Check incomplete pairs
  const localKeywords = keywords.filter(k => k.keywordType === 'LOCAL')
  const coreKeywords = keywords.filter(k => k.keywordType === 'CORE')
  const unpairedLocal = localKeywords.filter(k => !k.pairId).length
  const unpairedCore = coreKeywords.filter(k => !k.pairId).length

  if (unpairedLocal > 0 || unpairedCore > 0) {
    issues.push({
      projectId,
      issueType: 'INCOMPLETE_KEYWORD_PAIR',
      severity: 'WARNING',
      description: `${unpairedLocal} LOCAL and ${unpairedCore} CORE keywords have no pair relationship assigned.`,
    })
  }

  // Create issues (skip if identical open issues already exist)
  for (const issue of issues) {
    const existing = await prisma.qAIssue.findFirst({
      where: {
        projectId: issue.projectId,
        issueType: issue.issueType,
        isResolved: false,
        importJobId: null,
      },
    })
    if (!existing) {
      await prisma.qAIssue.create({ data: issue })
    }
  }

  return issues.length
}
