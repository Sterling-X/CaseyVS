# CaseyVS SEO Reporting Platform (Phase 2 MVP)

Reusable monthly SEO reporting operations app built with Next.js + Prisma.
This phase refines the existing architecture to support real export shapes:
- Semrush Position Tracking Rankings Overview (wide matrix CSV/XLSX)
- Google Search Console Performance ZIP (Queries/Pages/Countries/Devices/Search appearance/Filters)

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn-style UI components
- Prisma ORM + SQLite (`file:./prisma/dev.db`)
- Zod validation
- `papaparse`, `xlsx`, `jszip`
- Recharts
- PDFKit for report export
- Jest tests

## Quick Start

1. Install dependencies

```bash
npm install
```

2. Apply schema/migrations

```bash
npm run db:migrate -- --name phase2_real_exports
```

3. Seed templates (clean workspace, zero projects/data rows)

```bash
npm run db:seed
```

4. Run app

```bash
npm run dev
```

Open `http://localhost:3000`.

If local dev gets stale chunk issues, run:

```bash
npm run dev:clean
```

## Working End-to-End Flow

1. Go to `Workspace (/)`.
2. Create a project from business URL.
3. Open `Import Center`.
4. Import `SEMRUSH_RANKINGS_OVERVIEW` using your Semrush Rankings Overview CSV.
5. Import `GSC_PERFORMANCE_ZIP` using your GSC Performance ZIP.
6. Review `QA` for validation/data health warnings.
7. Open `Dashboard` for the one-page executive SEO view.
8. Click `Export PDF`.

## Supported Import Sources (Phase 2)

Primary:
- `SEMRUSH_RANKINGS_OVERVIEW`
- `GSC_PERFORMANCE_ZIP`

Legacy (still available):
- `SEMRUSH_VISIBILITY`
- `SEMRUSH_MAP_PACK`
- `SEMRUSH_ORGANIC`
- `GSC_QUERY`

## Real File Shape Handling

### Semrush Rankings Overview

The adapter detects repeated domain/date groups in wide headers and normalizes to row-level records.

Stored fields include:
- `keyword`, `tags`, `intents`
- `domain`, `date`, `rank`, `rankingType`, `landingUrl`, `difference`
- `searchVolume`, `cpc`, `keywordDifficulty`

Notes:
- `-` / blank rank values become `null` (not ranking).
- No fake native SoLV is created from this export.
- Dashboard uses a clearly labeled derived `Visibility Proxy` metric from ranking positions.

### GSC Performance ZIP

ZIP is unpacked server-side and parsed into:
- `GSCQueryRecord`
- `GSCPageRecord`
- `GSCCountryRecord`
- `GSCDeviceRecord`
- `GSCSearchAppearanceRecord`
- `GSCImportMeta` (filters/search type/date labels)

Current vs previous metrics are preserved for all GSC dimensions.

## One-Page Executive Dashboard

Sections:
- Top KPI summary
- Ranking distribution (overall/local/organic)
- Competitor summary
- Keyword movement (winners/losers/gained/lost)
- Landing page summary
- GSC summary (total/non-brand/non-brand+non-page + included/excluded queries)
- Data quality summary

Export:
- PDF via `Export PDF` button or `/api/reports/pdf`

## Exclusion Engine

Project-level exclusions support:
- Brand exclusions
- Page-specific exclusions

Each GSC query is marked:
- included/excluded
- brand/page flags
- exclusion reasons

Dashboard shows included and excluded query lists for auditability.

## QA / Data Health

Checks include:
- failed header detection
- malformed Semrush group headers
- invalid ranking values
- missing import metadata
- empty imports
- duplicate imports for same month/source
- keywords not mapped to project keyword sets
- missing competitor mapping
- missing market values in multi-market setups
- date inconsistencies
- likely branded/page-specific queries not excluded
- large ranking swings

## Sample Files

- `sample-data/semrush/position_tracking_rankings_overview_sample.csv`
- `sample-data/gsc/performance_sample.zip`
- ZIP expanded fixtures: `sample-data/gsc/performance_zip/*`

## Data Model Additions (Phase 2)

- `SemrushRankingRecord`
- `GSCImportMeta`
- `GSCPageRecord`
- `GSCCountryRecord`
- `GSCDeviceRecord`
- `GSCSearchAppearanceRecord`

Schema is SQLite-first and can be upgraded to Postgres with datasource migration.

## Tests

Run:

```bash
npm test -- --runInBand
```

Includes:
- Semrush overview adapter normalization
- GSC ZIP adapter parsing
- mapping/validation
- exclusion logic
- pairing logic
- CSV parser behavior

## Scripts

- `npm run dev`
- `npm run dev:clean`
- `npm run build`
- `npm run start`
- `npm run db:migrate`
- `npm run db:generate`
- `npm run db:seed`
- `npm run db:reset`
- `npm test`

## Configuration Conventions

- Canonical Next.js config: `next.config.js`
- Canonical PostCSS config: `postcss.config.js`
- Stale Next build backups like `.next_stale_*` are ignored by git and should not be committed.

## Troubleshooting

- Recommended Node.js: `20.x` (`.nvmrc`).
- Node `24.x` can cause unstable Next dev chunk behavior.
- If UI loads unstyled or import preview fails after code changes:
  1. stop dev server
  2. run `npm run dev:clean`
  3. restart `npm run dev`
