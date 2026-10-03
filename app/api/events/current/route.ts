import { NextResponse } from "next/server"

import { connectMongoDB } from "@/lib/mongodb"
import Event from "@/models/event"

import {
  DEFAULT_TIME_ZONE,
  getCurrentBusinessDate,
} from "@/lib/businessTime"

// La respuesta depende de la hora actual del request.
// No debe cachearse ni pre-renderizarse estáticamente.
export const dynamic = "force-dynamic"

export async function GET() {
  await connectMongoDB()

  const timeZone = DEFAULT_TIME_ZONE
  const businessDate =
    getCurrentBusinessDate(timeZone)
  const businessDateUtc =
    new Date(`${businessDate}T00:00:00.000Z`)
  const now = new Date()

  const eventSelected = await Event.findOne({
    businessDate: businessDateUtc,
    timeZone,
    closeAt: { $gt: now },
  })
    .sort({ startsAt: 1 })
    .lean<{
      _id: string
      name: string
      businessDate: Date
      timeZone: string
      startsAt: Date
      listClosedAt: Date
      closeAt: Date
    }>()

  if (!eventSelected) {
    return NextResponse.json(
      {
        ok: true,
        event: null,
        businessDate,
      },
      { status: 200 }
    )
  }

  return NextResponse.json(
    {
      ok: true,
      event: {
        ...eventSelected,
        businessDate: eventSelected.businessDate
          .toISOString()
          .slice(0, 10),
      },
      businessDate,
    },
    { status: 200 }
  )
}