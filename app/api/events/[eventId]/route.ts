import { auth } from "@/app/utils/auth";
import { connectMongoDB } from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";
import Event from "@/models/event"
import mongoose from "mongoose";
import { isAccountRole } from "@/app/utils/isAccountRole";

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

    const event = await Event.findById(eventId)
      .lean();

    return NextResponse.json(event);
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

  console.log("----> byId --->[eventId]/");
 
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const userRole = session.user.role;
  if (userRole !== "ADMINISTRADOR" && userRole !== "NEO" && userRole !== "LISTERO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
 
  const { eventId } = await params;
 
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }
 
  const body = await request.json().catch(() => null);
 
  const name = body?.name;
  const date = body?.date;
  const closeTime = body?.closeTime;

  console.log("Params", eventId, name, date, closeTime);
 
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "'name' es requerido" }, { status: 400 });
  }
 
  if (typeof date !== "string" || !date.trim()) {
    return NextResponse.json({ error: "'date' es requerido" }, { status: 400 });
  }
 
  if (!isAccountRole(userRole)) {
    return NextResponse.json({ error: "'role' inválido" }, { status: 400 });
  }
 
  await connectMongoDB();
  const update: Record<string, unknown> = {
    name: name.trim(),
    date: date.trim().toLowerCase(),
    closeTime,
  };
 
  try {
    const updated = await Event.findByIdAndUpdate(
      eventId,
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err: unknown) {
    return NextResponse.json({ error: "Error al actualizar el evento" }, { status: 500 });
  }
}