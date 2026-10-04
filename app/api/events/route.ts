import { NextRequest, NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import Event from "@/models/event";
import { auth } from "@/app/utils/auth";
import User from "@/models/user";
import BILista from "@/models/biLista"
import {
  EVENT_TIME_ZONE,
  getEventCountdownStart,
  getEventImportDeadline,
  getEventSchedule,
} from "@/lib/eventClose";

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
    const userData = await User.findById(userId).lean<{
      role: string;
      maxAttendersByEvent: number;
      maxImportTime?: string;
    }>();
    if(!userData) {
      return NextResponse.json({ ok: false, error: "No se encuentra al usuario" })
    }

    const events = await Event.find({})
      .sort({ businessDate: -1, startsAt: -1 })
      .limit(10)
      .lean();
      
    if(!events || events.length === 0) {
      return NextResponse.json({ ok: true, events: [], canImport: true }, { status: 200 });
    }
      
    const ahora = new Date();
    const biRegs = await BILista.find({
      userId,
      eventId: { $in: events.map((event) => event._id) },
    }).lean();
    const registrationsByEvent = new Map(
      biRegs.map((registration) => [
        String(registration.eventId),
        registration.inscritos,
      ])
    );

    const importStatusByEvent = new Map<
      string,
      { canImport: boolean; importDeadline: string | null }
    >(
      events.map((event) => {
        const deadline = getEventImportDeadline(
          event.businessDate,
          event.listClosedAt,
          userData.role === "LISTERO_PRO",
          event.closeAt,
          userData.maxImportTime
        );
        const inscritos = registrationsByEvent.get(String(event._id)) ?? 0;

        return [
          String(event._id),
          {
            canImport: Boolean(
              deadline &&
              ahora < deadline &&
              inscritos < userData.maxAttendersByEvent
            ),
            importDeadline: deadline?.toISOString() ?? null,
          },
        ];
      })
    );
    const canImport =
      importStatusByEvent.get(String(events[0]._id))?.canImport ?? false;

    return NextResponse.json({
      ok: true,
      events: events.map((event) => {
        const eventStart =
          event.startsAt ?? getEventCountdownStart(event.businessDate);
        const importStatus = importStatusByEvent.get(String(event._id));

        return {
          ...event,
          businessDate: event.businessDate.toISOString().slice(0, 10),
          canImport: importStatus?.canImport ?? false,
          importDeadline: importStatus?.importDeadline ?? null,
          isActive: Boolean(
            eventStart &&
            ahora >= eventStart &&
            ahora < new Date(event.closeAt)
          ),
        };
      }),
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
  if (!session || (session.user?.role !== "ADMINISTRADOR" && session.user?.role !== "NEO")) {
    return NextResponse.json({ ok: false, error: "No session" }, { status: 401 });
  }
  await connectMongoDB();

  const {
    name,
    businessDate,
    startTime,
    listCloseTime,
    closeTime,
  } = await req.json();

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof businessDate !== "string" ||
    typeof startTime !== "string" ||
    typeof listCloseTime !== "string" ||
    typeof closeTime !== "string"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "Datos incompletos",
      },
      { status: 400 }
    );
  }

  const schedule = getEventSchedule(
    businessDate,
    startTime,
    listCloseTime,
    closeTime
  );

  if (!schedule.ok) {
    return NextResponse.json(
      { ok: false, message: schedule.message },
      { status: 400 }
    );
  }

  const event = await Event.create({
    userId: session.user.id,
    businessDate: schedule.businessDate,
    startsAt: schedule.startsAt,
    timeZone: EVENT_TIME_ZONE,
    listClosedAt: schedule.listClosedAt,
    closeAt: schedule.closeAt,
    name: name.trim(),
    arrives: 0,
    total: 0,
    averageCheckTime: 0
  });


  return NextResponse.json({
    ok: true,
    id: event.id,
  });
}