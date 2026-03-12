import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const competitorSchema = z.object({
  domain: z.string().min(1, 'Domain is required'),
  name: z.string().optional(),
  isPrimary: z.boolean().optional(),
  projectId: z.string().min(1),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const competitors = await prisma.competitor.findMany({
      where: { projectId, isActive: true },
      orderBy: [{ isPrimary: 'desc' }, { domain: 'asc' }],
    })

    return NextResponse.json(competitors)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch competitors' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = competitorSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const competitor = await prisma.competitor.create({
      data: {
        domain: parsed.data.domain,
        name: parsed.data.name ?? null,
        isPrimary: parsed.data.isPrimary ?? false,
        projectId: parsed.data.projectId,
      },
    })

    return NextResponse.json(competitor, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Competitor already exists in this project' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create competitor' }, { status: 500 })
  }
}
