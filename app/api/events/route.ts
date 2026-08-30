import { NextRequest, NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import Event from "@/models/event";
import { auth } from "@/app/utils/auth";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { message: "No autenticado" },
        { status: 401 }
      );
    }

    await connectMongoDB();

    const events = await Event.find({})
      .sort({ date: -1 })
      .limit(10)
      .lean();

    return NextResponse.json(events);
  } catch (error) {
    console.error("GET /api/events:", error);

    return NextResponse.json(
      { message: "Error al obtener los eventos" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  console.log("Por aca el POST ------>")
  const session = await auth();
  if (!session || session.user?.role !== "ADMINISTRADOR") {
    return NextResponse.json({ ok: false, error: "No session" }, { status: 401 });
  }
  await connectMongoDB();

  const {
    name,
    date,
    closeTime
  } = await req.json();

  if (!date || !name || closeTime === undefined) {
    return NextResponse.json(
      {
        ok: false,
        message: "Datos incompletos",
      },
      { status: 400 }
    );
  }

  const event = await Event.create({
    userId: session.user.id,
    createdAt: new Date(),
    date,
    closeTime,
    name,
    arrives: 0,
    total: 0,
    averageCheckTime: 0
  });


  return NextResponse.json({
    ok: true,
    id: event.id,
  });
}