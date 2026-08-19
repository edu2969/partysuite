import { NextRequest, NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import Event from "@/models/event";
import Attender from "@/models/attender";
import Guest from "@/models/guest";
import User from "@/models/user";
import { auth } from "@/app/utils/auth";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
      session.user.role !== "EMBAJADOR" &&
      session.user.role !== "PORTERIA"
    ) {
      return NextResponse.json(
        { message: "No tiene permisos para ver asistentes" },
        { status: 403 }
      );
    }

    const { eventId } = await params;
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();

    await connectMongoDB();

    const event = await Event.findById(eventId).lean();

    if (!event) {
      return NextResponse.json(
        { message: "Evento no encontrado" },
        { status: 404 }
      );
    }

    const baseQuery: Record<string, unknown> = { eventId };

    if (q) {
      const regex = new RegExp(escapeRegex(q), "i");

      const guestMatches = await Guest.find({ names: regex }).select("_id").lean();
      const rpMatches = await User.find({ name: regex }).select("_id").lean();

      const guestIds = guestMatches.map((g) => g._id);
      const rpIds = rpMatches.map((u) => u._id);

      baseQuery.$or = [
        { guestId: { $in: guestIds } },
        { rpId: { $in: rpIds } },
      ];
    }

    const attenders = await Attender.find(baseQuery)
      .populate("guestId", "names baneado")
      .populate("rpId", "name")
      .sort({ fecha: 1 })
      .lean();

    const items = attenders.map((attender) => {
      const guest = attender.guestId as { _id?: string; names?: string; baneado?: boolean } | null;
      const rp = attender.rpId as { _id?: string; name?: string } | null;

      return {
        _id: String(attender._id),
        guestId: String(guest?._id || ""),
        names: guest?.names || "",
        rp: rp?.name || "",
        baneado: Boolean(guest?.baneado),
        checktime: attender.checktime ? new Date(attender.checktime).toISOString() : undefined,
      };
    });

    return NextResponse.json({
      event,
      items,
    });
  } catch (error) {
    console.error("GET /api/events/[eventId]/attenders:", error);

    return NextResponse.json(
      {
        message: "Error al obtener asistentes",
      },
      { status: 500 }
    );
  }
}
