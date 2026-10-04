import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/app/utils/auth";
import { connectMongoDB } from "@/lib/mongodb";
import {
  DEFAULT_TIME_ZONE,
  getCurrentBusinessDate,
  isDateClosed,
} from "@/lib/businessTime";
import Attender from "@/models/attender";
import BILista from "@/models/biLista";
import Event from "@/models/event";
import Guest from "@/models/guest";
import { horaNocturna } from "@/lib/time";

const checkInActions = [
  "Ingresa",
  "Paga",
  "Rechazado",
  "Baneado",
] as const;

type CheckInAction = (typeof checkInActions)[number];

interface ConfirmCheckInRequest {
  rut?: string;
  action?: CheckInAction;
}

interface AttenderUpdate {
  checktime: Date;
  paid?: boolean;
  rejected?: boolean;
  banned?: boolean;
}

function resultMessage(
  item: string,
  status: number,
  canConfirm = false
) {
  return NextResponse.json(
    {
      danger: [{ item }],
      canConfirm,
    },
    { status }
  );
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

export async function POST(request: NextRequest) {
  try {
    await connectMongoDB();

    const session = await auth();
    if (!session?.user?.id) {
      return resultMessage(
        "Se perdió la sesión. Por favor, autentíquese nuevamente",
        401
      );
    }

    if (session.user.role !== "PORTERIA") {
      return resultMessage(
        "No tiene permisos para confirmar ingresos",
        403
      );
    }

    const body: ConfirmCheckInRequest = await request.json();
    const rut = body.rut?.trim();
    const action = body.action;

    if (!rut) {
      return resultMessage("RUT requerido", 400);
    }

    if (!action || !checkInActions.includes(action)) {
      return resultMessage("Acción de check-in no válida", 400);
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
        arrives: number;
        averageCheckTime?: Date | null;
      }>();

    if (!event) {
      return resultMessage("No existe un evento para este horario", 404);
    }

    const closeAt = event.closeAt ? new Date(event.closeAt) : null;
    if (!closeAt || Number.isNaN(closeAt.getTime())) {
      console.error(`El evento ${event._id} no tiene un closeAt válido`);
      return resultMessage(
        "El evento no tiene configurada una hora de término válida",
        500
      );
    }

    const checktime = new Date();
    if (isDateClosed(closeAt) || checktime.getTime() >= closeAt.getTime()) {
      return resultMessage("El evento ya ha cerrado", 409);
    }

    const guest = await Guest.findOne({ rut: rut.slice(0, -1) });
    if (!guest) {
      return resultMessage(`${rut} inexistente`, 404);
    }

    if (guest.banned && action !== "Baneado") {
      return resultMessage(
        `${guest.names} está baneado. Confirme la opción Baneado`,
        409,
        true
      );
    }

    const currentAttender = await Attender.findOne({
      eventId: event._id,
      guestId: guest._id,
    }).lean<{
      _id: unknown;
      checktime?: Date | null;
      paid?: boolean;
      rejected?: boolean;
      banned?: boolean;
      userId: unknown;
    }>();
    const previousChecktime = currentAttender?.checktime ?? null;
    const alreadyCounted =
      Boolean(previousChecktime) &&
      (currentAttender?.paid === true ||
        (currentAttender?.rejected !== true &&
          currentAttender?.banned !== true));

    const update: AttenderUpdate = { checktime };
    if (action === "Paga") update.paid = true;
    if (action === "Rechazado") update.rejected = true;
    if (action === "Baneado") update.banned = true;

    const countsAsArrival = action === "Ingresa" || action === "Paga";
    let attender;
    try {
      if (currentAttender) {
        const updateOperation: {
          $set: AttenderUpdate;
          $unset?: { rejected: 1 };
        } = { $set: update };
        if (countsAsArrival && currentAttender.rejected === true) {
          updateOperation.$unset = { rejected: 1 };
        }

        attender = await Attender.findOneAndUpdate(
          countsAsArrival && !alreadyCounted
            ? {
                _id: currentAttender._id,
                checktime: previousChecktime,
              }
            : { _id: currentAttender._id },
          updateOperation,
          { new: true, runValidators: true }
        );
      } else {
        attender = await Attender.create({
          eventId: event._id,
          guestId: guest._id,
          userId: session.user.id,
          ...update,
        });
      }
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;

      const conflictingAttender = await Attender.findOne({
        eventId: event._id,
        guestId: guest._id,
      }).lean<{ checktime?: Date | null }>();
      const checkedAt = conflictingAttender?.checktime
        ? ` ${horaNocturna(conflictingAttender.checktime)}`
        : "";
      return resultMessage(`${guest.names} ya fue confirmado${checkedAt}`, 409, true);
    }

    if (!attender) {
      const latestAttender = await Attender.findOne({
        eventId: event._id,
        guestId: guest._id,
      }).lean<{ checktime?: Date | null }>();
      const checkedAt = latestAttender?.checktime
        ? ` ${horaNocturna(latestAttender.checktime)}`
        : "";
      return resultMessage(
        `${guest.names} ya fue confirmado${checkedAt}`,
        409,
        true
      );
    }

    if (action === "Baneado") {
      await Guest.updateOne(
        { _id: guest._id },
        { $set: { banned: true } }
      );
    }

    if (countsAsArrival && !alreadyCounted) {
      const arrives = guest.arrives || 0;
      const inscriptions = guest.inscriptions || 0;
      await Guest.updateOne(
        { _id: guest._id },
        {
          $inc: { arrives: 1 },
          $set: {
            ratio: inscriptions > 0 ? (arrives + 1) / inscriptions : 0,
          },
        }
      );

      const previousArrives = event.arrives || 0;
      const previousAverageMs = event.averageCheckTime
        ? new Date(event.averageCheckTime).getTime()
        : 0;
      const averageCheckTimeMs =
        previousArrives === 0
          ? checktime.getTime()
          : (checktime.getTime() +
              previousArrives * previousAverageMs) /
            (previousArrives + 1);

      await Event.updateOne(
        { _id: event._id },
        {
          $inc: { arrives: 1 },
          $set: { averageCheckTime: new Date(averageCheckTimeMs) },
        }
      );

      await BILista.updateOne(
        {
          eventId: event._id,
          userId: attender.userId,
        },
        { $inc: { asisten: 1 } }
      );
    }

    const actionLabel: Record<CheckInAction, string> = {
      Ingresa: "ingreso confirmado",
      Paga: "pago confirmado",
      Rechazado: "rechazo confirmado",
      Baneado: "invitado baneado",
    };

    return NextResponse.json({
      success: [{ item: `${guest.names}: ${actionLabel[action]}` }],
      checktime: checktime.toISOString(),
      canConfirm: false,
    });
  } catch (error) {
    console.error("ConfirmarCheckIn:", error);
    return NextResponse.json(
      {
        danger: [{ item: "Ocurrió un error al confirmar el check-in" }],
        canConfirm: false,
      },
      { status: 500 }
    );
  }
}
