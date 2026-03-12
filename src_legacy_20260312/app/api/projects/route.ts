import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  industry: z.string().optional(),
  domain: z.string().min(1, 'Domain is required'),
  description: z.string().optional(),
  templateId: z.string().optional(),
  markets: z.array(z.string()).optional(),
})

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      where: { isActive: true },
      include: {
        template: { select: { name: true, slug: true } },
        markets: true,
        _count: {
          select: {
            competitors: true,
            importJobs: { where: { status: 'COMMITTED' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(projects)
  } catch (error) {
    console.error('GET /api/projects error:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createProjectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { name, industry, domain, description, templateId, markets } = parsed.data

    const project = await prisma.project.create({
      data: {
        name,
        industry,
        domain,
        description,
        templateId: templateId ?? null,
        markets: markets?.length
          ? { create: markets.map(m => ({ name: m })) }
          : undefined,
      },
      include: {
        markets: true,
        template: true,
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('POST /api/projects error:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
