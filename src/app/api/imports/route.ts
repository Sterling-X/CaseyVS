import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const jobs = await prisma.importJob.findMany({
      where: { projectId },
      include: {
        mappingProfile: { select: { name: true } },
        _count: {
          select: {
            visibilityRecords: true,
            mapPackRecords: true,
            organicRecords: true,
            gscRecords: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(jobs)
  } catch (error) {
    console.error('GET /api/imports error:', error)
    return NextResponse.json({ error: 'Failed to fetch imports' }, { status: 500 })
  }
}
