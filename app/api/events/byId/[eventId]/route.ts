import { NextRequest, NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import Event from "@/models/event";
import Attender from "@/models/attender";
import BIRP from "@/models/birp";
import { getSession } from "next-auth/react";

interface RouteContext {
  params: Promise<{
    eventId: string;
  }>;
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          message: "No autenticado",
        },
        { status: 401 }
      );
    }

    const role = session.user.role;
    const isRPAdmin = session.user.role === "EMBAJADOR";

    if (role !== "ADMINISTRADOR" && !isRPAdmin) {
      return NextResponse.json(
        {
          message: "No tiene permisos para eliminar eventos",
        },
        { status: 403 }
      );
    }

    const { eventId } = await context.params;

    await connectMongoDB();

    const event = await Event.findById(eventId);

    if (!event) {
      return NextResponse.json(
        {
          message: "Evento no encontrado",
        },
        { status: 404 }
      );
    }

    await Promise.all([
      Attender.deleteMany({
        eventId,
      }),

      BIRP.deleteMany({
        eventoId: eventId,
      }),
    ]);

    await Event.deleteOne({
      _id: eventId,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("DELETE /api/events/[eventId]:", error);

    return NextResponse.json(
      {
        message: "Error al eliminar el evento",
      },
      { status: 500 }
    );
  }
}