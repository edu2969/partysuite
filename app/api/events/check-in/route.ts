import { NextRequest, NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import { getEventDayRange, listaCerrada } from "@/lib/eventDay";
import { horaNocturna } from "@/lib/time";
import Event from "@/models/event";
import Guest from "@/models/guest";
import Attender from "@/models/attender";
import User from "@/models/user";
import BILista from "@/models/biLista";
import { auth } from "@/app/utils/auth";

interface RegisterArrivalRequest {
  rut: string;
  dudosa?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    await connectMongoDB();

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          danger: [
            {
              item: "Se perdió la sesión. Por favor, autentíquese nuevamente",
            },
          ],
        },
        { status: 401 }
      );
    }

    if (session.user.role !== "PORTERIA") {
      return NextResponse.json(
        {
          danger: [
            {
              item: "No tiene permisos para registrar ingresos",
            },
          ],
        },
        { status: 403 }
      );
    }

    const body: RegisterArrivalRequest = await request.json();

    const rut = body.rut?.trim();
    const baneado = body.dudosa === true;

    if (!rut) {
      return NextResponse.json(
        {
          danger: [
            {
              item: "RUT requerido",
            },
          ],
        },
        { status: 400 }
      );
    }

    // Mismo criterio que GET /api/events/current: antes de las 5am, el
    // evento "de hoy" en términos de negocio sigue siendo el de ayer (la
    // fiesta sigue funcionando pasada la medianoche). Antes esto solo
    // buscaba dentro del día calendario actual, así que fallaba en la
    // madrugada — ahora usa el mismo helper que /current.
    const { desde, hasta } = getEventDayRange();

    const evnt = await Event.findOne({
      date: {
        $gte: desde,
        $lt: hasta,
      },
    });

    if (!evnt) {
      return NextResponse.json(
        {
          danger: [
            {
              item: "No existe un evento para hoy",
            },
          ],
        },
        { status: 404 }
      );
    }

    // Si la hora de cierre ya pasó, se corta acá antes de tocar invitados/asistencia.
    if (listaCerrada(evnt)) {
      return NextResponse.json({
        danger: [
          {
            item: "La lista ha cerrado. Lo sentimos",
          },
        ],
      });
    }

    const guest = await Guest.findOne({
      rut: rut.slice(0, -1),
    });

    if (!guest) {
      return NextResponse.json({
        danger: [
          {
            item: `${rut} inexistente`,
          },
        ],
      });
    }

    const attender = await Attender.findOne({
      eventId: evnt._id,
      guestId: guest._id,
    });

    if (!attender) {
      return NextResponse.json({
        danger: [
          {
            item: `${rut} no inscrito`,
          },
        ],
      });
    }

    if (baneado) {
      await Guest.updateOne(
        {
          _id: guest._id,
        },
        {
          $set: {
            baneado: true,
          },
        }
      );

      guest.baneado = true;
    }

    if (guest.baneado) {
      return NextResponse.json({
        warning: [
          {
            item: `${rut} No presente en la lista`,
          },
        ],
      });
    }

    if (attender.checktime !== null && attender.checktime !== undefined) {
      return NextResponse.json({
        danger: [
          {
            item: `${guest.names} ya ingresó ${horaNocturna(
              attender.checktime
            )}`,
          },
        ],
      });
    }

    const rp = await User.findById(attender.rpId).lean<{ name: string }>();

    const nombreRP = rp?.name || "Sin RP";

    const checktime = Date.now() - desde.getTime();

    const previousArrives = evnt.arrives || 0;
    const previousAverage = evnt.averageCheckTime || 0;

    const averageCheckTime =
      (checktime + previousArrives * previousAverage) /
      (previousArrives + 1);

    const attenderUpdate = await Attender.updateOne(
      {
        _id: attender._id,
        $or: [{ checktime: null }, { checktime: { $exists: false } }],
      },
      {
        $set: {
          checktime,
        },
      }
    );

    if (attenderUpdate.matchedCount === 0) {
      return NextResponse.json({
        danger: [
          {
            item: `${guest.names} ya ingresó ${horaNocturna(
              attender.checktime ?? checktime
            )}`,
          },
        ],
      });
    }

    await Guest.updateOne(
      {
        _id: guest._id,
      },
      {
        $inc: {
          asistencias: 1,
        },
      }
    );

    const eventUpdate: {
      $inc: {
        arrives: number;
      };
      $set: {
        averageCheckTime: number;
      };
    } = {
      $inc: {
        arrives: 1,
      },
      $set: {
        averageCheckTime,
      },
    };

    await Event.updateOne(
      {
        _id: evnt._id,
      },
      eventUpdate
    );

    await BILista.updateOne(
      {
        eventId: evnt._id,
        userId: attender.rpId,
      },
      {
        $inc: {
          asisten: 1,
        },
      }
    );

    const bienvenida = `Bienvenid@ ${guest.names}`;

    return NextResponse.json({
      success: [
        {
          item: `${bienvenida} (RP: ${nombreRP})`,
        },
      ],
    });
  } catch (error) {
    console.error("RegistrarIngreso:", error);

    return NextResponse.json(
      {
        danger: [
          {
            item: "Ocurrió un error al registrar el ingreso",
          },
        ],
      },
      { status: 500 }
    );
  }
}
