import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/app/utils/auth";
import { connectMongoDB } from "@/lib/mongodb";
import {
  DEFAULT_TIME_ZONE,
  getCurrentBusinessDate,
  isDateClosed,
} from "@/lib/businessTime";
import { horaNocturna } from "@/lib/time";
import Attender from "@/models/attender";
import Event from "@/models/event";
import Guest from "@/models/guest";

interface CheckInLookupRequest {
  rut?: string;
}

function resultMessage(kind: "danger", item: string, status: number) {
  return NextResponse.json(
    {
      [kind]: [{ item }],
      canConfirm: false,
    },
    { status }
  );
}

export async function POST(request: NextRequest) {
  try {
    await connectMongoDB();

    const session = await auth();
    if (!session?.user?.id) {
      return resultMessage(
        "danger",
        "Se perdió la sesión. Por favor, autentíquese nuevamente",
        401
      );
    }

    if (session.user.role !== "PORTERIA") {
      return resultMessage(
        "danger",
        "No tiene permisos para consultar ingresos",
        403
      );
    }

    const body: CheckInLookupRequest = await request.json();
    const rut = body.rut?.trim();
    if (!rut) {
      return resultMessage("danger", "RUT requerido", 400);
    }

    const timeZone = DEFAULT_TIME_ZONE;
    const businessDate = getCurrentBusinessDate(timeZone);
    const event = await Event.findOne({
      businessDate: new Date(`${businessDate}T00:00:00.000Z`),
      timeZone,
    })
      .sort({ startsAt: 1 })
      .lean<{
        _id: string;
        closeAt?: Date | null;
      }>();

    if (!event) {
      return resultMessage(
        "danger",
        "No existe un evento para este horario",
        404
      );
    }

    const closeAt = event.closeAt ? new Date(event.closeAt) : null;
    if (!closeAt || Number.isNaN(closeAt.getTime())) {
      console.error(`El evento ${event._id} no tiene un closeAt válido`);
      return resultMessage(
        "danger",
        "El evento no tiene configurada una hora de término válida",
        500
      );
    }

    if (isDateClosed(closeAt)) {
      return resultMessage("danger", "El evento ya ha cerrado", 409);
    }

    const guest = await Guest.findOne({ rut: rut.slice(0, -1) }).lean<{
      _id: string;
      names: string;
    }>();

    if (!guest) {
      return resultMessage("danger", `${rut} inexistente`, 404);
    }

    const attender = await Attender.findOne({
      eventId: event._id,
      guestId: guest._id,
    }).lean<{
      checktime?: Date | null;
    }>();
    const registered = Boolean(attender);
    if (attender?.checktime) {
      return NextResponse.json({
        registered,
        guestName: guest.names,
        canConfirm: true,
        warning: [
          {
            item: `${guest.names} ya ingresó ${horaNocturna(attender.checktime)}`,
          },
        ],
      });
    }

    const item = registered
      ? `${guest.names} inscrito`
      : `${guest.names} no inscrito`;

    return NextResponse.json({
      registered,
      guestName: guest.names,
      canConfirm: true,
      ...(registered
        ? { success: [{ item }] }
        : { warning: [{ item }] }),
    });
  } catch (error) {
    console.error("ConsultarCheckIn:", error);
    return NextResponse.json(
      {
        danger: [{ item: "Ocurrió un error al consultar la inscripción" }],
        canConfirm: false,
      },
      { status: 500 }
    );
  }
}
