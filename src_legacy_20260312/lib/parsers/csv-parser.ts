import Papa from 'papaparse'

export interface ParseResult {
  headers: string[]
  rows: Record<string, string>[]
  totalRows: number
  error?: string
}

export function parseCSVString(content: string): ParseResult {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
    transform: (v: string) => v.trim(),
  })

  if (result.errors.length > 0 && result.data.length === 0) {
    return {
      headers: [],
      rows: [],
      totalRows: 0,
      error: result.errors[0].message,
    }
  }

  const headers = result.meta.fields ?? []

  return {
    headers,
    rows: result.data,
    totalRows: result.data.length,
  }
}

export async function parseFileToString(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

export function detectDelimiter(content: string): string {
  const firstLine = content.split('\n')[0]
  const commaCount = (firstLine.match(/,/g) ?? []).length
  const tabCount = (firstLine.match(/\t/g) ?? []).length
  const semicolonCount = (firstLine.match(/;/g) ?? []).length
  if (tabCount > commaCount && tabCount > semicolonCount) return '\t'
  if (semicolonCount > commaCount) return ';'
  return ','
}

// Auto-suggest column mappings based on common header patterns
export function suggestColumnMappings(
  headers: string[],
  targetFields: string[]
): Record<string, string> {
  const suggestions: Record<string, string> = {}

  const patterns: Record<string, RegExp[]> = {
    keyword: [/^keyword$/i, /^search.?term$/i, /^query$/i, /^kw$/i],
    competitor_domain: [/^domain$/i, /^competitor/i, /^url$/i, /^website$/i],
    visibility_score: [/^visibility$/i, /^vis\.?score$/i, /^visibility.?score$/i],
    solv_score: [/^solv$/i, /^share.?of.?local.?voice$/i, /^solv.?score$/i],
    traffic_score: [/^traffic$/i, /^traffic.?score$/i, /^est\.?.?traffic$/i],
    domain: [/^domain$/i, /^website$/i, /^url$/i, /^site$/i],
    position: [/^position$/i, /^rank$/i, /^ranking$/i, /^pos\.?$/i],
    date: [/^date$/i, /^period$/i, /^month$/i, /^report.?date$/i],
    market: [/^market$/i, /^location$/i, /^city$/i, /^geo$/i, /^region$/i],
    device: [/^device$/i, /^platform$/i],
    url: [/^url$/i, /^landing.?page$/i, /^page.?url$/i],
    search_volume: [/^search.?volume$/i, /^volume$/i, /^sv$/i, /^monthly.?searches$/i],
    query: [/^query$/i, /^search.?query$/i, /^search.?term$/i, /^keyword$/i],
    clicks: [/^clicks$/i, /^click$/i],
    impressions: [/^impressions$/i, /^impr\.?$/i, /^imp$/i],
    ctr: [/^ctr$/i, /^click.?through.?rate$/i, /^click.?rate$/i],
    average_position: [/^position$/i, /^avg\.?.?position$/i, /^average.?position$/i, /^rank$/i],
    date_range_start: [/^date.?start$/i, /^start.?date$/i, /^from.?date$/i],
    date_range_end: [/^date.?end$/i, /^end.?date$/i, /^to.?date$/i],
  }

  for (const header of headers) {
    for (const targetField of targetFields) {
      if (targetField in patterns) {
        const fieldPatterns = patterns[targetField]
        if (fieldPatterns.some(p => p.test(header))) {
          if (!(header in suggestions)) {
            suggestions[header] = targetField
          }
        }
      }
    }
  }

  return suggestions
}
