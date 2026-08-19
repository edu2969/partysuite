import { NextRequest, NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import Event from "@/models/event";
import Guest from "@/models/guest";
import Attender from "@/models/attender";
import BIRP from "@/models/birp";
import User from "@/models/user";
import { checkRut } from "@/app/utils/rut";
import { auth } from "@/app/utils/auth";
import moment from "moment";

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

    const body: ImportRequest = await request.json();
    const { entradas, eventId } = body;

    console.log("Entradas", entradas, eventId)

    if (!Array.isArray(entradas) || !eventId) {
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

    const momentoCierre = moment().add(1, "day").startOf("day").add(eventSelected.closeTime, "millisecond");
    if (momentoCierre.isBefore(new Date())) {
      return NextResponse.json({
        danger: [
          {
            item: "La lista ha cerrado. Lo sentimos",
          },
        ],
      });
    }

    let totalImported = 0;
    let messages: Messages = {};

    const addMessage = (
      type: "success" | "warning" | "danger",
      item: string
    ) => {
      if (!messages[type]) {
        messages[type] = [];
      }

      messages[type]!.push({ item });
    };

    for (let i = 0; i < entradas.length; i++) {
      if (!entradas[i] || entradas[i].trim().length === 0) {
        continue;
      }

      const entrada = entradas[i].trim();
      const datos = entrada.split(/\s+/);

      const ultimoDato = datos[datos.length - 1];

      let rut = ultimoDato.replace("-", "");
      rut = rut.split(".").join("");

      if (
        datos.length < 3 ||
        (!/^[a-zA-ZÀ-ÿ]+$/.test(datos[0]) &&
          !/^[a-zA-ZÀ-ÿ]+$/.test(datos[1]))
      ) {
        addMessage(
          "success",
          `${entrada} [Nombre irreconocible]`
        );
      }

      if (checkRut(rut)) {
        const rutNoDv = rut.substring(0, rut.length - 1);

        let guest = await Guest.findOne({
          rut: rutNoDv,
        });

        if (!guest) {
          guest = await Guest.create({
            rut: rutNoDv,
            names: `${datos[0]} ${datos[1]}`,
            asistencias: 0,
            inscripciones: 0,
          });
        }

        if (guest.baneado) {
          addMessage(
            "danger",
            `${guest.names} baneado ${
              guest.observacion
                ? guest.observacion
                : "(Sin razón descrita)"
            }`
          );
        } else {
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
              console.log(`No RP!: ${attender.rpId}`);
            }
          } else {
            const rpId = session.user.id;

            if (rpId) {
              await Attender.create({
                eventId,
                rpId,
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
            } else {
              addMessage(
                "danger",
                "Se perdió la sesión. Por favor, autentíquese nuevamente"
              );
            }
          }
        }
      } else {
        addMessage(
          "danger",
          `Rut erroneo: [${entrada}]`
        );

        if (!messages.wrongRuts) {
          messages.wrongRuts = "";
        }

        messages.wrongRuts += `${entrada}\n`;
      }
    }

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

      const rpId = session.user.id;

      const reg = await BIRP.findOne({
        eventoId: eventId,
        rpId,
      });

      if (!reg) {
        await BIRP.create({
          eventoId: eventId,
          rpId,
          asisten: 0,
          inscritos: totalImported,
        });
      } else {
        await BIRP.updateOne(
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