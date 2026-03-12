import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatReportingMonth(month: string): string {
  try {
    return format(parseISO(`${month}-01`), 'MMMM yyyy')
  } catch {
    return month
  }
}

export function getReportingMonthOptions(count = 24): { value: string; label: string }[] {
  const options = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = format(d, 'yyyy-MM')
    const label = format(d, 'MMMM yyyy')
    options.push({ value, label })
  }
  return options
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

export function formatPercent(n: number, decimals = 1): string {
  return `${(n * 100).toFixed(decimals)}%`
}

export function formatScore(n: number, decimals = 1): string {
  return n.toFixed(decimals)
}

export function rankMovement(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null
  return previous - current // positive = improved (lower rank number is better)
}

export function rankMovementLabel(movement: number | null): string {
  if (movement === null) return '—'
  if (movement === 0) return '→'
  return movement > 0 ? `▲${movement}` : `▼${Math.abs(movement)}`
}

export function rankMovementClass(movement: number | null): string {
  if (movement === null || movement === 0) return 'text-muted-foreground'
  return movement > 0 ? 'text-green-600' : 'text-red-600'
}

export function parseReportingMonth(value: string): { year: number; month: number } {
  const [year, month] = value.split('-').map(Number)
  return { year, month }
}

export function getPreviousMonth(reportingMonth: string): string {
  const { year, month } = parseReportingMonth(reportingMonth)
  const d = new Date(year, month - 2, 1)
  return format(d, 'yyyy-MM')
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}…`
}

export function safeParseFloat(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = parseFloat(String(value).replace(/[,%]/g, ''))
  return isNaN(n) ? null : n
}

export function safeParseInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = parseInt(String(value).replace(/[,%]/g, ''), 10)
  return isNaN(n) ? null : n
}

export function normalizeDate(value: unknown): Date | null {
  if (!value) return null
  try {
    const s = String(value).trim()
    // Handle common date formats from Semrush (Jan 01, 2024 / 2024-01-01 / 01/01/2024)
    const d = new Date(s)
    if (!isNaN(d.getTime())) return d
    return null
  } catch {
    return null
  }
}

export function extractReportingMonth(date: Date | null, fallback?: string): string {
  if (!date) return fallback ?? format(new Date(), 'yyyy-MM')
  return format(date, 'yyyy-MM')
}
