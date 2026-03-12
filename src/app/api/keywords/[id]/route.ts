import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const updateKeywordSchema = z.object({
  text: z.string().min(1).optional(),
  keywordType: z.enum(['LOCAL', 'CORE', 'BRANDED', 'OTHER']).optional(),
  intentGroup: z.string().nullable().optional(),
  marketId: z.string().nullable().optional(),
  keywordSetId: z.string().nullable().optional(),
  isPrimaryTarget: z.boolean().optional(),
  isActive: z.boolean().optional(),
  pairId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const parsed = updateKeywordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const keyword = await prisma.keyword.update({
      where: { id: params.id },
      data: parsed.data,
      include: { market: true, keywordSet: true },
    })

    return NextResponse.json(keyword)
  } catch (error) {
    console.error('PATCH /api/keywords/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update keyword' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.keyword.update({
      where: { id: params.id },
      data: { isActive: false },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete keyword' }, { status: 500 })
  }
}
