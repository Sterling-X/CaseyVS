import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const pairSchema = z.object({
  localKeywordId: z.string().min(1),
  coreKeywordId: z.string().min(1),
})

const unpairSchema = z.object({
  keywordId: z.string().min(1),
})

// POST /api/keywords/pair - create a local<->core pair
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = pairSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { localKeywordId, coreKeywordId } = parsed.data

    // Set both to point to each other (using the coreKeywordId as the canonical pair reference)
    await prisma.$transaction([
      prisma.keyword.update({
        where: { id: localKeywordId },
        data: { pairId: coreKeywordId },
      }),
      prisma.keyword.update({
        where: { id: coreKeywordId },
        data: { pairId: localKeywordId },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/keywords/pair error:', error)
    return NextResponse.json({ error: 'Failed to pair keywords' }, { status: 500 })
  }
}

// DELETE /api/keywords/pair - remove pairing for a keyword
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = unpairSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { keywordId } = parsed.data
    const keyword = await prisma.keyword.findUnique({ where: { id: keywordId } })
    if (!keyword) {
      return NextResponse.json({ error: 'Keyword not found' }, { status: 404 })
    }

    // Remove pair from both sides
    const updates = [
      prisma.keyword.update({ where: { id: keywordId }, data: { pairId: null } }),
    ]
    if (keyword.pairId) {
      updates.push(
        prisma.keyword.update({ where: { id: keyword.pairId }, data: { pairId: null } })
      )
    }

    await prisma.$transaction(updates)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to unpair keywords' }, { status: 500 })
  }
}
