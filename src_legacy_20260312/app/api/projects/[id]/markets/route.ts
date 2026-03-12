import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const marketSchema = z.object({
  name: z.string().min(1),
  region: z.string().optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const markets = await prisma.market.findMany({
      where: { projectId: params.id },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(markets)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch markets' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const parsed = marketSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const market = await prisma.market.create({
      data: { ...parsed.data, projectId: params.id },
    })
    return NextResponse.json(market, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create market' }, { status: 500 })
  }
}
