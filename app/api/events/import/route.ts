import { NextRequest, NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import Event from "@/models/event";
import Guest from "@/models/guest";
import Attender from "@/models/attender";
import BILista from "@/models/biLista";
import User from "@/models/user";
import { checkRut } from "@/app/utils/rut";
import { auth } from "@/app/utils/auth";
import moment, { max } from "moment";

interface ImportRequest {
  entradas: string[];
  eventId: string;
}

interface MessageItem {
  item: string;
}

interface Messages {
  success?: MessageItem[];
  warning?: MessageItem[];
  danger?: MessageItem[];
  wrongRuts?: string;
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

    const userId = session.user.id;

    const body: ImportRequest = await request.json();
    const { entradas, eventId } = body;

    const userData = await User.findById(userId).lean<{
      role: string
      maxAttendersByEvent: number
    }>();

    if (!Array.isArray(entradas) || !eventId || !userData) {
      return NextResponse.json(
        {
          danger: [
            {
              item: "Datos de importación inválidos",
            },
          ],
        },
        { status: 400 }
      );
    }

    const eventSelected = await Event.findById(eventId);

    if (!eventSelected) {
      return NextResponse.json(
        {
          danger: [
            {
              item: "Evento no encontrado",
            },
          ],
        },
        { status: 404 }
      );
    }

    let totalImported = 0;
    const messages: Messages = {};

    const addMessage = (
      type: "success" | "warning" | "danger",
      item: string
    ) => {
      if (!messages[type]) {
        messages[type] = [];
      }

      messages[type]!.push({ item });
    };

    if(userData.role === "LISTERO") {
      const momentoCierre = moment(eventSelected.closedAt);
      if (momentoCierre.isBefore(new Date())) {
        addMessage("danger", "La lista ha cerrado. Lo sentimos");
        return NextResponse.json(messages);
      }
      const countAttenders = await Attender.find({
        eventId: eventId
      }).countDocuments();
      const maxImport = userData.maxAttendersByEvent - countAttenders;      
      if(maxImport < entradas.length) {
        addMessage(
          "danger",
          `Puedes importar hasta ${maxImport} invitados`
        );
        addMessage(
          "warning",
          `${entradas.length} fueron omitidos`
        );
        return NextResponse.json(messages);
      }
    }

    for (let i = 0; i < entradas.length; i++) {
      if (!entradas[i] || entradas[i].trim().length === 0) {
        continue;
      }

      const entrada = entradas[i].trim();

      /*
       * ---------------------------------------------------------
       * 1. Separar los datos
       * ---------------------------------------------------------
       */

      const datos = entrada.split(/\s+/);

      if (datos.length < 3) {
        addMessage(
          "danger",
          `${entrada} [Debe ingresar nombre, apellido y RUT]`
        );
        continue;
      }

      /*
       * El último elemento siempre debe ser el RUT.
       */
      const ultimoDato = datos[datos.length - 1];

      /*
       * ---------------------------------------------------------
       * 2. Validar que exista nombre y apellido
       * ---------------------------------------------------------
       *
       * Permitimos nombres con:
       * - letras
       * - tildes
       * - ñ
       * - apóstrofe
       * - guión
       *
       * Ejemplos válidos:
       * Juan Perez
       * José María González
       * María José Pérez Soto
       * Juan-Pablo Pérez
       * O'Connor Pérez
       */

      const nombreRegex = /^[a-zA-ZÀ-ÿÑñ'-]+$/;

      const nombrePartes = datos.slice(0, -1);

      const nombreValido =
        nombrePartes.length >= 2 &&
        nombrePartes.every((parte) => nombreRegex.test(parte));

      if (!nombreValido) {
        addMessage(
          "danger",
          `${entrada} [Nombre o apellido inválido]`
        );
        continue;
      }

      /*
       * ---------------------------------------------------------
       * 3. Validar y normalizar RUT
       * ---------------------------------------------------------
       *
       * Se aceptan:
       *
       * 12.345.678-5
       * 12345678-5
       * 123456785
       * 12.345.678-K
       * 12345678-k
       *
       * Primero eliminamos puntos y espacios.
       */

      const rut = ultimoDato
        .replace(/\./g, "")
        .replace(/\s+/g, "")
        .trim();

      /*
       * El RUT debe tener:
       *
       * cuerpo numérico
       * opcionalmente guión
       * dígito verificador
       *
       * Ej:
       * 12345678-5
       * 12345678K
       */

      const rutMatch = rut.match(/^(\d+)-?([0-9kK])$/);

      if (!rutMatch) {
        addMessage(
          "danger",
          `Rut erroneo: [${entrada}]`
        );

        if (!messages.wrongRuts) {
          messages.wrongRuts = "";
        }

        messages.wrongRuts += `${entrada}\n`;

        continue;
      }

      const rutCuerpo = rutMatch![1];
      const rutDv = rutMatch![2];

      /*
       * checkRut recibe cuerpo + DV SIN guión.
       */
      const rutCompleto = `${rutCuerpo}${rutDv}`;

      if (!checkRut(rutCompleto)) {
        addMessage(
          "danger",
          `Rut erroneo: [${entrada}]`
        );

        if (!messages.wrongRuts) {
          messages.wrongRuts = "";
        }

        messages.wrongRuts += `${entrada}\n`;

        continue;
      }

      /*
       * ---------------------------------------------------------
       * 4. Buscar / crear Guest
       * ---------------------------------------------------------
       */

      const rutNoDv = rutCuerpo;

      let guest = await Guest.findOne({
        rut: rutNoDv,
      });

      if (!guest) {
        guest = await Guest.create({
          rut: rutNoDv,
          names: nombrePartes.join(" "),
          asistencias: 0,
          inscripciones: 0,
        });
      }

      /*
       * ---------------------------------------------------------
       * 5. Verificar si está baneado
       * ---------------------------------------------------------
       */

      if (guest.baneado) {
        addMessage(
          "danger",
          `${guest.names} baneado ${
            guest.observacion
              ? guest.observacion
              : "(Sin razón descrita)"
          }`
        );

        continue;
      }

      /*
       * ---------------------------------------------------------
       * 6. Verificar si ya está inscrito
       * ---------------------------------------------------------
       */

      const attender = await Attender.findOne({
        eventId,
        guestId: guest._id,
      });

      if (attender) {
        const rp = await User.findById(attender.rpId);

        if (rp) {
          addMessage(
            "warning",
            `${guest.names} inscrito por: ${rp.name}`
          );
        } else {
          addMessage(
            "warning",
            `${guest.names} ya está inscrito`
          );
        }

        continue;
      }

      /*
       * ---------------------------------------------------------
       * 7. Crear inscripción
       * ---------------------------------------------------------
       */

      const userId = session?.user.id;

      if (!userId) {
        addMessage(
          "danger",
          "Se perdió la sesión. Por favor, autentíquese nuevamente"
        );

        continue;
      }

      await Attender.create({
        eventId,
        userId,
        guestId: guest._id,
        fecha: new Date(),
      });

      addMessage(
        "success",
        `${entrada} OK`
      );

      totalImported++;

      await Guest.updateOne(
        {
          _id: guest._id,
        },
        {
          $inc: {
            inscripciones: 1,
          },
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * 8. Actualizar estadísticas del evento
     * ---------------------------------------------------------
     */

    if (totalImported > 0) {
      await Event.updateOne(
        {
          _id: eventId,
        },
        {
          $inc: {
            total: totalImported,
          },
        }
      );

      const userId = session?.user.id;

      const reg = await BILista.findOne({
        eventId: eventId,
        userId,
      });

      if (!reg) {
        await BILista.create({
          eventId: eventId,
          userId,
          asisten: 0,
          inscritos: totalImported,
        });
      } else {
        await BILista.updateOne(
          {
            _id: reg._id,
          },
          {
            $inc: {
              inscritos: totalImported,
            },
          }
        );
      }
    }

    return NextResponse.json(messages);
  } catch (error) {
    console.error("processListImport:", error);

    return NextResponse.json(
      {
        danger: [
          {
            item: "Ocurrió un error procesando la lista",
          },
        ],
      },
      { status: 500 }
    );
  }
}