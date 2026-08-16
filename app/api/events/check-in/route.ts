import { NextRequest, NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import Event from "@/models/event";
import Guest from "@/models/guest";
import Attender from "@/models/attender";
import BIRP from "@/models/birp";
import User from "@/models/user";
import { auth } from "@/app/utils/auth";

interface RegisterArrivalRequest {
  rut: string;
  baneado?: boolean;
}

interface Message {
  item: string;
}

interface Messages {
  success?: Message[];
  warning?: Message[];
  danger?: Message[];
}

function horaNocturna(timestamp: Date | number) {
  const date = new Date(timestamp);

  return date.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          message: "No autenticado",
        },
        { status: 401 }
      );
    }

    await connectMongoDB();

    const events = await Event.find({})
      .sort({ date: -1 })
      .lean();

    return NextResponse.json({
      events,
    });
  } catch (error) {
    console.error("GET /api/events:", error);

    return NextResponse.json(
      {
        message: "Error al obtener los eventos",
      },
      { status: 500 }
    );
  }
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
    const baneado = body.baneado === true;

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

    const now = new Date();

    const desde = new Date(now);
    desde.setHours(0, 0, 0, 0);

    const hasta = new Date(desde);
    hasta.setDate(hasta.getDate() + 1);

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
            item: `${rut} bloqueado`,
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

    const rp = await User.findById(attender.rpId).lean<typeof User>();

    const nombreRP = rp?.name || "Sin RP";

    const checktime =
      now.getTime() - desde.getTime();

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
              attender.checktime ?? now
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

    await BIRP.updateOne(
      {
        eventoId: evnt._id,
        rpId: attender.rpId,
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