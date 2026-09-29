import { NextRequest, NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import Event from "@/models/event";
import { auth } from "@/app/utils/auth";
import {
  parseAttenderSort,
  parsePagination,
  queryAttenders,
} from "@/app/utils/attendersQuery";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "No autenticado" },
        { status: 401 }
      );
    }

    if (
      session.user.role !== "ADMINISTRADOR" &&
      session.user.role !== "NEO"
    ) {
      return NextResponse.json(
        { message: "No tiene permisos para ver asistentes" },
        { status: 403 }
      );
    }

    const { eventId } = await params;
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const { page, pageSize } = parsePagination(searchParams);
    const sorting = parseAttenderSort(searchParams);

    await connectMongoDB();

    const [event, result] = await Promise.all([
      Event.findById(eventId).lean(),
      queryAttenders({ eventId, q, page, pageSize, ...sorting }),
    ]);

    return NextResponse.json({ event, ...result });
  } catch (error) {
    console.error("GET /api/events/[eventId]/attenders:", error);

    return NextResponse.json(
      { message: "Error al obtener asistentes" },
      { status: 500 }
    );
  }
}