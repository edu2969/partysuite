import { NextRequest, NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import Event from "@/models/event";
import Guest from "@/models/guest";
import Attender from "@/models/attender";
import BILista from "@/models/biLista";
import User from "@/models/user";
import { checkRut } from "@/app/utils/rut";
import { auth } from "@/app/utils/auth";
import { getEventImportDeadline } from "@/lib/eventClose";

const IMPORT_BATCH_SIZE = 50;

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

interface ParsedEntry {
  entrada: string;
  rut: string;
  names: string;
}

interface GuestData {
  _id: { toString(): string };
  rut: string;
  names: string;
  banned?: boolean;
  observation?: string;
}

interface ExistingAttender {
  guestId: { toString(): string };
  rpId?: { toString(): string };
}

function addMessage(
  messages: Messages,
  type: "success" | "warning" | "danger",
  item: string
) {
  messages[type] ??= [];
  messages[type]!.push({ item });
}

function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const mongoError = error as {
    code?: number;
    writeErrors?: Array<{ code?: number }>;
  };

  if (mongoError.code === 11000) return true;

  return Boolean(
    mongoError.writeErrors?.length &&
      mongoError.writeErrors.every((writeError) => writeError.code === 11000)
  );
}

async function processBatch(
  entradas: string[],
  eventId: string,
  userId: string
): Promise<{ messages: Messages; totalImported: number }> {
  const messages: Messages = {};
  const parsedEntries: ParsedEntry[] = [];
  const nombreRegex = /^[a-zA-ZÀ-ÿÑñ'-]+$/;

  for (const rawEntry of entradas) {
    const entrada = rawEntry.trim();
    const datos = entrada.split(/\s+/);

    if (datos.length < 3) {
      addMessage(
        messages,
        "danger",
        `${entrada} [Debe ingresar nombre, apellido y RUT]`
      );
      continue;
    }

    const nombrePartes = datos.slice(0, -1);
    if (
      nombrePartes.length < 2 ||
      !nombrePartes.every((parte) => nombreRegex.test(parte))
    ) {
      addMessage(
        messages,
        "danger",
        `${entrada} [Nombre o apellido inválido]`
      );
      continue;
    }

    const rut = datos[datos.length - 1]
      .replace(/\./g, "")
      .replace(/\s+/g, "")
      .trim();
    const rutMatch = rut.match(/^(\d+)-?([0-9kK])$/);

    if (!rutMatch || !checkRut(`${rutMatch[1]}${rutMatch[2]}`)) {
      addMessage(messages, "danger", `Rut erroneo: [${entrada}]`);
      messages.wrongRuts = `${messages.wrongRuts ?? ""}${entrada}\n`;
      continue;
    }

    parsedEntries.push({
      entrada,
      rut: rutMatch[1],
      names: nombrePartes.join(" "),
    });
  }

  if (parsedEntries.length === 0) {
    return { messages, totalImported: 0 };
  }

  const firstEntryByRut = new Map<string, ParsedEntry>();
  for (const entry of parsedEntries) {
    if (!firstEntryByRut.has(entry.rut)) {
      firstEntryByRut.set(entry.rut, entry);
    }
  }

  let guests = await Guest.find({
    rut: { $in: Array.from(firstEntryByRut.keys()) },
  }).lean<GuestData[]>();
  const existingRuts = new Set(guests.map((guest) => guest.rut));
  const missingGuests = Array.from(firstEntryByRut.values()).filter(
    (entry) => !existingRuts.has(entry.rut)
  );

  if (missingGuests.length > 0) {
    try {
      await Guest.bulkWrite(
        missingGuests.map((entry) => ({
          updateOne: {
            filter: { rut: entry.rut },
            update: {
              $setOnInsert: {
                rut: entry.rut,
                names: entry.names,
                arrives: 0,
                inscriptions: 0,
              },
            },
            upsert: true,
          },
        })),
        { ordered: false }
      );
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }

    guests = await Guest.find({
      rut: { $in: Array.from(firstEntryByRut.keys()) },
    }).lean<GuestData[]>();
  }

  const guestByRut = new Map(guests.map((guest) => [guest.rut, guest]));
  const guestIds = Array.from(
    new Set(
      parsedEntries
        .map((entry) => guestByRut.get(entry.rut)?._id.toString())
        .filter((id): id is string => Boolean(id))
    )
  );
  const existingAttenders = await Attender.find({
    eventId,
    guestId: { $in: guestIds },
  })
    .select("guestId rpId")
    .lean<ExistingAttender[]>();
  const existingByGuestId = new Map(
    existingAttenders.map((attender) => [
      attender.guestId.toString(),
      attender,
    ])
  );
  const rpIds = Array.from(
    new Set(
      existingAttenders
        .map((attender) => attender.rpId?.toString())
        .filter((id): id is string => Boolean(id))
    )
  );
  const rps = rpIds.length
    ? await User.find({ _id: { $in: rpIds } })
        .select("name")
        .lean<Array<{ _id: { toString(): string }; name: string }>>()
    : [];
  const rpNameById = new Map(
    rps.map((rp) => [rp._id.toString(), rp.name])
  );
  const candidatesByGuestId = new Map<
    string,
    { entry: ParsedEntry; guest: GuestData }
  >();

  for (const entry of parsedEntries) {
    const guest = guestByRut.get(entry.rut);
    if (!guest) {
      throw new Error(`No fue posible preparar el invitado ${entry.rut}`);
    }

    if (guest.banned) {
      addMessage(
        messages,
        "danger",
        `${guest.names} banned ${
          guest.observation || "(Sin razón descrita)"
        }`
      );
      continue;
    }

    const guestId = guest._id.toString();
    const existingAttender = existingByGuestId.get(guestId);
    if (existingAttender) {
      const rpName = existingAttender.rpId
        ? rpNameById.get(existingAttender.rpId.toString())
        : undefined;
      addMessage(
        messages,
        "warning",
        rpName
          ? `${guest.names} inscrito por: ${rpName}`
          : `${guest.names} ya está inscrito`
      );
      continue;
    }

    if (candidatesByGuestId.has(guestId)) {
      addMessage(
        messages,
        "warning",
        `${guest.names} ya está inscrito`
      );
      continue;
    }

    candidatesByGuestId.set(guestId, { entry, guest });
  }

  const candidates = Array.from(candidatesByGuestId.values());
  const createdCandidates: typeof candidates = [];

  if (candidates.length > 0) {
    const result = await Attender.bulkWrite(
      candidates.map(({ guest }) => ({
        updateOne: {
          filter: { eventId, guestId: guest._id },
          update: {
            $setOnInsert: {
              eventId,
              userId,
              guestId: guest._id,
            },
          },
          upsert: true,
        },
      }))
    );

    candidates.forEach((candidate, index) => {
      if (Object.prototype.hasOwnProperty.call(result.upsertedIds, index)) {
        createdCandidates.push(candidate);
        addMessage(messages, "success", `${candidate.entry.entrada} OK`);
      } else {
        addMessage(
          messages,
          "warning",
          `${candidate.guest.names} ya está inscrito`
        );
      }
    });
  }

  const totalImported = createdCandidates.length;
  if (totalImported > 0) {
    await Promise.all([
      Guest.bulkWrite(
        createdCandidates.map(({ guest }) => ({
          updateOne: {
            filter: { _id: guest._id },
            update: { $inc: { inscriptions: 1 } },
          },
        }))
      ),
      Event.updateOne(
        { _id: eventId },
        { $inc: { total: totalImported } }
      ),
      (async () => {
        try {
          await BILista.updateOne(
            { eventId, userId },
            {
              $inc: { inscritos: totalImported },
              $setOnInsert: { asisten: 0 },
            },
            { upsert: true }
          );
        } catch (error) {
          if (!isDuplicateKeyError(error)) throw error;
          await BILista.updateOne(
            { eventId, userId },
            { $inc: { inscritos: totalImported } }
          );
        }
      })(),
    ]);
  }

  return { messages, totalImported };
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
      role: string;
      maxAttendersByEvent: number;
      maxImportTime?: string;
    }>();

    if (
      !Array.isArray(entradas) ||
      !entradas.every((entry) => typeof entry === "string") ||
      !eventId ||
      !userData
    ) {
      return NextResponse.json(
        {
          danger: [{ item: "Datos de importación inválidos" }],
        },
        { status: 400 }
      );
    }

    const eventSelected = await Event.findById(eventId);
    if (!eventSelected) {
      return NextResponse.json(
        {
          danger: [{ item: "Evento no encontrado" }],
        },
        { status: 404 }
      );
    }

    if (
      userData.role === "LISTERO" ||
      userData.role === "LISTERO_PRO"
    ) {
      const importDeadline = getEventImportDeadline(
        eventSelected.businessDate,
        eventSelected.listClosedAt,
        userData.role === "LISTERO_PRO",
        eventSelected.closeAt,
        userData.maxImportTime
      );

      if (!importDeadline) {
        console.error(
          `El evento ${eventId} no tiene una hora de cierre de importación válida`
        );
        return NextResponse.json(
          {
            danger: [
              { item: "No se pudo verificar la hora de cierre de la lista" },
            ],
          },
          { status: 500 }
        );
      }

      if (Date.now() >= importDeadline.getTime()) {
        return NextResponse.json(
          {
            danger: [{ item: "La lista ha cerrado. Lo sentimos" }],
          }
        );
      }
    }

    if (userData.role === "LISTERO") {
      const countAttenders = await Attender.countDocuments({
        userId,
        eventId,
      });
      const maxImport = userData.maxAttendersByEvent - countAttenders;

      if (maxImport < entradas.length) {
        const messages: Messages = {};
        addMessage(messages, "danger", `Puedes importar hasta ${maxImport} invitados`);
        addMessage(messages, "warning", `${entradas.length} fueron omitidos`);
        return NextResponse.json(messages);
      }
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: Record<string, unknown>) => {
          controller.enqueue(
            encoder.encode(`${JSON.stringify(event)}\n`)
          );
        };

        let totalImported = 0;
        try {
          for (let start = 0; start < entradas.length; start += IMPORT_BATCH_SIZE) {
            const batch = entradas.slice(start, start + IMPORT_BATCH_SIZE);
            const result = await processBatch(batch, eventId, userId);
            totalImported += result.totalImported;

            send({
              type: "progress",
              processed: Math.min(start + batch.length, entradas.length),
              total: entradas.length,
              messages: result.messages,
            });
          }

          send({
            type: "completed",
            totalImported,
          });
        } catch (error) {
          console.error("processListImport:", error);
          send({
            type: "error",
            message: "Ocurrió un error procesando la lista",
          });
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Content-Type-Options": "nosniff",
      },
    });
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
