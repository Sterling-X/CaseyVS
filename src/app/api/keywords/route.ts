import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const keywordSchema = z.object({
  text: z.string().min(1, 'Keyword text is required'),
  keywordType: z.enum(['LOCAL', 'CORE', 'BRANDED', 'OTHER']),
  intentGroup: z.string().optional(),
  marketId: z.string().optional(),
  keywordSetId: z.string().optional(),
  projectId: z.string().min(1),
  isPrimaryTarget: z.boolean().optional(),
  pairId: z.string().optional(),
  notes: z.string().optional(),
})

const bulkKeywordSchema = z.object({
  projectId: z.string().min(1),
  keywords: z.array(z.object({
    text: z.string().min(1),
    keywordType: z.enum(['LOCAL', 'CORE', 'BRANDED', 'OTHER']),
    intentGroup: z.string().optional(),
    marketId: z.string().optional(),
    keywordSetId: z.string().optional(),
    isPrimaryTarget: z.boolean().optional(),
    pairId: z.string().optional(),
  })),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const keywordType = searchParams.get('keywordType')
    const intentGroup = searchParams.get('intentGroup')
    const marketId = searchParams.get('marketId')
    const activeOnly = searchParams.get('activeOnly') !== 'false'

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const keywords = await prisma.keyword.findMany({
      where: {
        projectId,
        ...(activeOnly ? { isActive: true } : {}),
        ...(keywordType ? { keywordType } : {}),
        ...(intentGroup ? { intentGroup } : {}),
        ...(marketId ? { marketId } : {}),
      },
      include: {
        market: true,
        keywordSet: true,
      },
      orderBy: [{ intentGroup: 'asc' }, { text: 'asc' }],
    })

    return NextResponse.json(keywords)
  } catch (error) {
    console.error('GET /api/keywords error:', error)
    return NextResponse.json({ error: 'Failed to fetch keywords' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Support bulk create
    if (body.keywords) {
      const parsed = bulkKeywordSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
      }

      const created = []
      for (const kw of parsed.data.keywords) {
        try {
          const keyword = await prisma.keyword.create({
            data: {
              ...kw,
              projectId: parsed.data.projectId,
              intentGroup: kw.intentGroup ?? null,
              marketId: kw.marketId ?? null,
              keywordSetId: kw.keywordSetId ?? null,
              pairId: kw.pairId ?? null,
              isPrimaryTarget: kw.isPrimaryTarget ?? false,
            },
          })
          created.push(keyword)
        } catch (e: any) {
          if (e.code !== 'P2002') throw e // ignore unique constraint violations
        }
      }
      return NextResponse.json({ created: created.length, keywords: created }, { status: 201 })
    }

    // Single create
    const parsed = keywordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const keyword = await prisma.keyword.create({
      data: {
        ...parsed.data,
        intentGroup: parsed.data.intentGroup ?? null,
        marketId: parsed.data.marketId ?? null,
        keywordSetId: parsed.data.keywordSetId ?? null,
        pairId: parsed.data.pairId ?? null,
        isPrimaryTarget: parsed.data.isPrimaryTarget ?? false,
      },
      include: { market: true, keywordSet: true },
    })

    return NextResponse.json(keyword, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Keyword already exists in this project' }, { status: 409 })
    }
    console.error('POST /api/keywords error:', error)
    return NextResponse.json({ error: 'Failed to create keyword' }, { status: 500 })
  }
}
