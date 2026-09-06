import { NextRequest, NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import Event from "@/models/event";
import { auth } from "@/app/utils/auth";
import User from "@/models/user";
import BILista from "@/models/biLista"
import moment from "moment";

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
    const userId = session.user.id;
    const userData = await User.findById(userId);
    if(!userData) {
      return NextResponse.json({ ok: false, error: "No se encuentra al usuario" })
    }

    const events = await Event.find({})
      .sort({ date: -1 })
      .limit(10)
      .lean();
      
    if(!events || events.length === 0) {
      return NextResponse.json({ ok: true, events: [], canImport: true }, { status: 200 });
    }
      
    const biReg = await BILista.findOne({
      userId,
      eventId: events[0]._id
    });

    const primerEvento = events[0];
    const horaLimite = moment(primerEvento.createdAt).add(29, 'hours'); // Cierre 5:00 am del día siguiente
    const ahora = moment();
    const canImport = (!biReg || (biReg.inscritos < userData.maxAttendersByEvent)) && ahora.isBefore(horaLimite);

    return NextResponse.json({
      ok: true,
      events: events,
      canImport
    }, { status: 200 });
  } catch (error) {
    console.error("GET /api/events:", error);

    return NextResponse.json(
      { message: "Error al obtener los eventos" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "ADMINISTRADOR") {
    return NextResponse.json({ ok: false, error: "No session" }, { status: 401 });
  }
  await connectMongoDB();

  const {
    name,
    date,
    closedAt
  } = await req.json();

  if (!date || !name || !closedAt) {
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
    closedAt,
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