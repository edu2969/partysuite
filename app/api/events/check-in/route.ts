import { NextRequest, NextResponse } from "next/server";

import { connectMongoDB } from "@/lib/mongodb";

import Event from "@/models/event";
import Guest from "@/models/guest";
import Attender from "@/models/attender";
import User from "@/models/user";
import BILista from "@/models/biLista";

import { auth } from "@/app/utils/auth";

import {
  DEFAULT_TIME_ZONE,
  getCurrentBusinessDate,
  isDateClosed,
} from "@/lib/businessTime";

import { horaNocturna } from "@/lib/time";

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
              item:
                "Se perdió la sesión. Por favor, autentíquese nuevamente",
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

    const body: RegisterArrivalRequest =
      await request.json();

    const rut = body.rut?.trim();
    const banned = body.dudosa === true;

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

    /*
     * ============================================================
     * 1. DETERMINAR EL EVENTO ACTUAL
     * ============================================================
     *
     * La fecha de negocio NO depende de la timezone del servidor.
     *
     * Antes de las 05:00 Chile:
     *     pertenece al evento de la noche anterior.
     *
     * Desde las 05:00:
     *     pertenece al día actual.
     */

    const timeZone = DEFAULT_TIME_ZONE;

    const businessDate =
      getCurrentBusinessDate(timeZone);

    const event = await Event.findOne({
      businessDate: new Date(`${businessDate}T00:00:00.000Z`),
      timeZone,
    })
      .sort({ startsAt: 1 })
      .lean<{
        _id: string;
        closeAt?: Date | null;
        arrives: number;
        averageCheckTime?: number | Date | null;
      }>();

    if (!event) {
      return NextResponse.json(
        {
          danger: [
            {
              item: "No existe un evento para este horario",
            },
          ],
        },
        { status: 404 }
      );
    }

    /*
     * ============================================================
     * 2. VALIDAR CIERRE DEL EVENTO
     * ============================================================
     *
     * closeAt es un instante absoluto almacenado en UTC.
     *
     * No necesitamos convertirlo a Chile para compararlo.
     */

    const closeAt = event.closeAt
      ? new Date(event.closeAt)
      : null;

    if (!closeAt || Number.isNaN(closeAt.getTime())) {
      console.error(
        `El evento ${event._id} no tiene un closeAt válido`
      );
      return NextResponse.json(
        {
          danger: [
            {
              item: "El evento no tiene configurada una hora de término válida",
            },
          ],
        },
        { status: 500 }
      );
    }

    if (isDateClosed(closeAt)) {
      return NextResponse.json({
        danger: [
          {
            item: "El evento ya ha cerrado",
          },
        ],
      });
    }

    /*
     * ============================================================
     * 4. BUSCAR INVITADO
     * ============================================================
     */

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

    /*
     * ============================================================
     * 5. BUSCAR INSCRIPCIÓN DEL INVITADO EN ESTE EVENTO
     * ============================================================
     */

    const attender = await Attender.findOne({
      eventId: event._id,
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

    /*
     * ============================================================
     * 6. MARCAR COMO DUDOSA / BANNED
     * ============================================================
     */

    if (banned) {
      await Guest.updateOne(
        {
          _id: guest._id,
        },
        {
          $set: {
            banned: true,
          },
        }
      );

      guest.banned = true;
    }

    if (guest.banned) {
      return NextResponse.json({
        warning: [
          {
            item: `${rut} No presente en la lista`,
          },
        ],
      });
    }

    /*
     * ============================================================
     * 7. CHECK-IN YA REALIZADO
     * ============================================================
     */

    if (
      attender.checktime !== null &&
      attender.checktime !== undefined
    ) {
      return NextResponse.json({
        danger: [
          {
            item: `${guest.names} ya ingresó ${horaNocturna(
              attender.checktime
            )}`,
          },
        ],
        checktime: new Date(attender.checktime).toISOString(),
      });
    }

    /*
     * ============================================================
     * 8. USUARIO / RP QUE REGISTRÓ LA INSCRIPCIÓN
     * ============================================================
     */

    const listero =
      await User.findById(attender.userId)
        .lean<{ name: string }>();

    const nombreRP =
      listero?.name || "Sin RP";

    /*
     * ============================================================
     * 9. INSTANTE ABSOLUTO DEL CHECK-IN
     * ============================================================
     *
     * MongoDB guarda esto como Date.
     *
     * No se guarda:
     *   - hora Chile
     *   - offset
     *   - segundos desde medianoche
     *
     * Se guarda el instante real.
     */

    const checktime = new Date();

    if (checktime.getTime() >= closeAt.getTime()) {
      return NextResponse.json({
        danger: [
          {
            item: "El evento ya ha cerrado",
          },
        ],
      });
    }

    const checktimeMs =
      checktime.getTime();

    /*
     * ============================================================
     * 10. PROMEDIO DE HORA DE INGRESO
     * ============================================================
     */

    const previousArrives =
      event.arrives || 0;

    const previousAverageMs =
      event.averageCheckTime
        ? new Date(
            event.averageCheckTime
          ).getTime()
        : 0;

    const averageCheckTimeMs =
      previousArrives === 0
        ? checktimeMs
        : (
            checktimeMs +
            previousArrives *
              previousAverageMs
          ) /
          (previousArrives + 1);

    const averageCheckTime =
      new Date(averageCheckTimeMs);

    /*
     * ============================================================
     * 11. CHECK-IN ATÓMICO
     * ============================================================
     *
     * MUY IMPORTANTE:
     *
     * No hacemos:
     *
     *   findOne()
     *   ...
     *   updateOne({ _id })
     *
     * porque dos lectores podrían procesar
     * al mismo invitado simultáneamente.
     *
     * El filtro checktime: null garantiza que
     * solamente uno pueda ganar.
     */

    const attenderUpdate =
      await Attender.updateOne(
        {
          _id: attender._id,
          checktime: null,
        },
        {
          $set: {
            checktime,
          },
        }
      );

    if (attenderUpdate.matchedCount === 0) {
      /*
       * Otro proceso/lector registró el ingreso
       * entre nuestro findOne() y este update.
       */

      const currentAttender =
        await Attender.findById(
          attender._id
        ).lean<{
          checktime?: Date | null;
        }>();

      return NextResponse.json({
        danger: [
          {
            item: `${guest.names} ya ingresó ${
              currentAttender?.checktime
                ? horaNocturna(
                    currentAttender.checktime
                  )
                : ""
            }`,
          },
        ],
        checktime: currentAttender?.checktime
          ? new Date(currentAttender.checktime).toISOString()
          : undefined,
      });
    }

    /*
     * ============================================================
     * 12. ACTUALIZAR INVITADO
     * ============================================================
     */

    await Guest.updateOne(
      {
        _id: guest._id,
      },
      {
        $inc: {
          arrives: 1,
        },
        $set: {
          ratio:
            (guest.arrives + 1) /
            guest.inscriptions,
        },
      }
    );

    /*
     * ============================================================
     * 13. ACTUALIZAR EVENTO
     * ============================================================
     */

    await Event.updateOne(
      {
        _id: event._id,
      },
      {
        $inc: {
          arrives: 1,
        },
        $set: {
          averageCheckTime,
        },
      }
    );

    /*
     * ============================================================
     * 14. ACTUALIZAR BI DE LISTA
     * ============================================================
     */

    await BILista.updateOne(
      {
        eventId: event._id,
        userId: attender.userId,
      },
      {
        $inc: {
          asisten: 1,
        },
      }
    );

    /*
     * ============================================================
     * 15. RESPUESTA
     * ============================================================
     */

    const bienvenida =
      `Bienvenid@ ${guest.names}`;

    return NextResponse.json({
      success: [
        {
          item:
            `${bienvenida} (RP: ${nombreRP})`,
        },
      ],
      checktime: checktime.toISOString(),
    });
  } catch (error) {
    console.error(
      "RegistrarIngreso:",
      error
    );

    return NextResponse.json(
      {
        danger: [
          {
            item:
              "Ocurrió un error al registrar el ingreso",
          },
        ],
      },
      { status: 500 }
    );
  }
}