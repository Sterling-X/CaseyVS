import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const updateSchema = z.object({
  domain: z.string().min(1).optional(),
  name: z.string().nullable().optional(),
  isPrimary: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const competitor = await prisma.competitor.update({
      where: { id: params.id },
      data: parsed.data,
    })
    return NextResponse.json(competitor)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update competitor' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.competitor.update({
      where: { id: params.id },
      data: { isActive: false },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete competitor' }, { status: 500 })
  }
}
