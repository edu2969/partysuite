import { auth } from "@/app/utils/auth";
import { connectMongoDB } from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";
import Event from "@/models/event"
import mongoose from "mongoose";
import { isAccountRole } from "@/app/utils/isAccountRole";
import User from "@/models/user";
import Attender from "@/models/attender";
import {
  EVENT_TIME_ZONE,
  getEventSchedule,
} from "@/lib/eventClose";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { message: "No autenticado" },
        { status: 401 }
      );
    }

    await connectMongoDB();

    const { eventId } = await params;
    const userId = session.user.id;
    const userData = await User.findById(userId).select("maxAttendersByEvent");
    const cantidadInscritos = await Attender.countDocuments({
      userId,
      eventId
    });    

    const event = await Event.findById(eventId)
      .lean<{
        _id: mongoose.Types.ObjectId;
        name: string;
        businessDate: Date;
        startsAt: Date;
      }>();

    if (!event) {
      return NextResponse.json(
        { message: "Evento no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, event: {
      ...event,
      businessDate: event.businessDate.toISOString().slice(0, 10),
      maxImport: userData.maxAttendersByEvent,
      actualImported: cantidadInscritos
    }}, { status: 200 });
  } catch (error) {
    console.error("GET /api/events:", error);

    return NextResponse.json(
      { message: "Error al obtener los eventos" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const userRole = session.user.role;
  if (userRole !== "ADMINISTRADOR" && userRole !== "NEO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
 
  const { eventId } = await params;
 
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }
 
  const body = await request.json().catch(() => null);
 
  const name = body?.name;
  const businessDate = body?.businessDate;
  const startTime = body?.startTime;
  const listCloseTime = body?.listCloseTime;
  const closeTime = body?.closeTime;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "'name' es requerido" }, { status: 400 });
  }
 
  if (
    typeof businessDate !== "string" ||
    typeof startTime !== "string" ||
    typeof listCloseTime !== "string" ||
    typeof closeTime !== "string"
  ) {
    return NextResponse.json(
      { error: "La fecha y las horas del evento son requeridas" },
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
      { message: schedule.message },
      { status: 400 }
    );
  }
 
  if (!isAccountRole(userRole)) {
    return NextResponse.json({ error: "'role' inválido" }, { status: 400 });
  }
 
  await connectMongoDB();
  const update: Record<string, unknown> = {
    name: name.trim(),
    businessDate: schedule.businessDate,
    startsAt: schedule.startsAt,
    timeZone: EVENT_TIME_ZONE,
    listClosedAt: schedule.listClosedAt,
    closeAt: schedule.closeAt,
  };
 
  try {
    const updated = await Event.findByIdAndUpdate(
      eventId,
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return NextResponse.json({ error: "Evento no actualizado" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err: unknown) {
    return NextResponse.json({ error: "Error al actualizar el evento" }, { status: 500 });
  }
}