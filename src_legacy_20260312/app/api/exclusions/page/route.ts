import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({
  term: z.string().min(1, 'Term is required'),
  category: z.string().optional(),
  isRegex: z.boolean().optional(),
  projectId: z.string().min(1),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const terms = await prisma.pageExclusionTerm.findMany({
    where: { projectId },
    orderBy: [{ category: 'asc' }, { term: 'asc' }],
  })
  return NextResponse.json(terms)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const term = await prisma.pageExclusionTerm.create({
      data: {
        term: parsed.data.term,
        category: parsed.data.category ?? null,
        isRegex: parsed.data.isRegex ?? false,
        projectId: parsed.data.projectId,
      },
    })
    return NextResponse.json(term, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create page exclusion' }, { status: 500 })
  }
}
