import { auth } from "@/app/utils/auth";
import { connectMongoDB } from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

import Event from "@/models/event";
import Attender from "@/models/attender";
import BILista from "@/models/biLista";
import Guest from "@/models/guest";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user || session.user.role !== "NEO") {
            return NextResponse.json(
                {
                    ok: false,
                    error: "No autorizado",
                },
                { status: 403 }
            );
        }

        const action = req.nextUrl.searchParams.get("action");

        if (!action) {
            return NextResponse.json(
                {
                    ok: false,
                    error: "Falta el parámetro action",
                },
                { status: 400 }
            );
        }

        await connectMongoDB();

        if (action === "checktimes") {
            return await reconstruirChecktimes();
        }

        if (action === "bilistas") {
            return await reconstruirBIListas();
        }

        return NextResponse.json(
            {
                ok: false,
                error: `Acción no válida: ${action}`,
            },
            { status: 400 }
        );

    } catch (error) {
        console.error("GET /api/regenerator:", error);

        return NextResponse.json(
            {
                ok: false,
                error: "Error al regenerar los datos",
            },
            { status: 500 }
        );
    }
}

const reconstruirChecktimes = async () => {
    const updated = await Attender.updateMany(
        {
            $expr: {
                $and: [
                    // createdAt es distinto de updatedAt
                    {
                        $ne: ["$createdAt", "$updatedAt"],
                    },

                    // checktime existe y no es null
                    {
                        $ne: ["$checktime", null],
                    },
                ],
            },
        },
        [
            {
                $set: {
                    checktime: "$updatedAt",
                },
            },
        ]
    );

    return NextResponse.json({
        ok: true,
        message: "Checktimes reconstruidos correctamente",
        updated: updated.modifiedCount,
    });
};

const reconstruirBIListas = async () => {
    // ============================================================
    // 1. Limpiar BIListas existentes
    // ============================================================

    const deleted = await BILista.deleteMany({});

    // ============================================================
    // 2. Obtener todos los eventos
    // ============================================================

    const events = await Event.find({})
        .select("_id")
        .lean();

    const eventIds = events.map((event) => event._id);

    // ============================================================
    // 3. Obtener todos los Attenders de los eventos
    // ============================================================

    const attenders = await Attender.find({
        eventId: {
            $in: eventIds,
        },
    })
        .select("eventId guestId userId checktime")
        .lean();

    // ============================================================
    // 4. Reconstruir BIListas
    //
    //    inscritos = cantidad de invitados asignados al RP
    //    asisten   = cantidad de invitados que tienen checktime
    // ============================================================

    const biListas = await Attender.aggregate([
        {
            $match: {
                eventId: {
                    $in: eventIds,
                },
            },
        },
        {
            $group: {
                _id: {
                    eventId: "$eventId",
                    userId: "$userId",
                },

                inscritos: {
                    $sum: 1,
                },

                asisten: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    {
                                        $ne: [
                                            "$checktime",
                                            null,
                                        ],
                                    },
                                    {
                                        $ne: [
                                            {
                                                $type: "$checktime",
                                            },
                                            "missing",
                                        ],
                                    },
                                ],
                            },
                            1,
                            0,
                        ],
                    },
                },
            },
        },
        {
            $project: {
                _id: 0,
                eventId: "$_id.eventId",
                userId: "$_id.userId",
                inscritos: 1,
                asisten: 1,
            },
        },
    ]);

    if (biListas.length > 0) {
        await BILista.insertMany(biListas);
    }

    // ============================================================
    // 5. Reconstruir datos de cada Guest
    //
    //    Un Guest puede aparecer en varios eventos.
    //    Por eso inscriptions y arrives se calculan globalmente
    //    desde Attender.
    // ============================================================

    const guestStats = await Attender.aggregate([
        {
            $group: {
                _id: "$guestId",

                inscriptions: {
                    $sum: 1,
                },

                arrives: {
                    $sum: {
                        $cond: [
                            {
                                $ne: [
                                    "$checktime",
                                    null,
                                ],
                            },
                            1,
                            0,
                        ],
                    },
                },
            },
        },
        {
            $project: {
                _id: 1,
                inscriptions: 1,
                arrives: 1,

                ratio: {
                    $cond: [
                        {
                            $gt: [
                                "$inscriptions",
                                0,
                            ],
                        },
                        {
                            $divide: [
                                "$arrives",
                                "$inscriptions",
                            ],
                        },
                        0,
                    ],
                },
            },
        },
    ]);

    // ============================================================
    // 6. Actualizar Guest
    // ============================================================

    if (guestStats.length > 0) {
        await Guest.bulkWrite(
            guestStats.map((guest) => ({
                updateOne: {
                    filter: {
                        _id: guest._id,
                    },
                    update: {
                        $set: {
                            inscriptions: guest.inscriptions,
                            arrives: guest.arrives,
                            ratio: guest.ratio,
                        },
                    },
                },
            }))
        );
    }

    // ============================================================
    // 7. Reconstruir datos de cada Event
    //
    //    total             = cantidad de Attenders
    //    arrives           = cantidad con checktime
    //    averageCheckTime  = promedio de timestamps de checktime
    // ============================================================

    const eventStats = await Attender.aggregate([
        {
            $match: {
                eventId: {
                    $in: eventIds,
                },
            },
        },
        {
            $group: {
                _id: "$eventId",

                total: {
                    $sum: 1,
                },

                arrives: {
                    $sum: {
                        $cond: [
                            {
                                $ne: [
                                    "$checktime",
                                    null,
                                ],
                            },
                            1,
                            0,
                        ],
                    },
                },

                averageCheckTime: {
                    $avg: "$checktime",
                },
            },
        },
    ]);

    // ============================================================
    // 8. Actualizar Event
    // ============================================================

    if (eventStats.length > 0) {
        await Event.bulkWrite(
            eventStats.map((event) => ({
                updateOne: {
                    filter: {
                        _id: event._id,
                    },
                    update: {
                        $set: {
                            total: event.total,
                            arrives: event.arrives,

                            // averageCheckTime es Number en el schema.
                            // MongoDB devuelve el promedio como número
                            // cuando promedia fechas.
                            averageCheckTime:
                                event.averageCheckTime ?? 0,
                        },
                    },
                },
            }))
        );
    }

    // ============================================================
    // 9. Eventos sin Attenders
    //
    //    También deben quedar correctamente en cero.
    // ============================================================

    const eventIdsWithStats = new Set(
        eventStats.map((event) =>
            event._id.toString()
        )
    );

    const eventsWithoutAttenders = eventIds.filter(
        (eventId: any) =>
            !eventIdsWithStats.has(
                eventId.toString()
            )
    );

    if (eventsWithoutAttenders.length > 0) {
        await Event.updateMany(
            {
                _id: {
                    $in: eventsWithoutAttenders,
                },
            },
            {
                $set: {
                    total: 0,
                    arrives: 0,
                    averageCheckTime: 0,
                },
            }
        );
    }

    // ============================================================
    // 10. Respuesta
    // ============================================================

    const totalAttenders = attenders.length;

    const totalArrives = attenders.filter(
        (attender) =>
            attender.checktime !== null &&
            attender.checktime !== undefined
    ).length;

    return NextResponse.json({
        ok: true,

        message:
            "BIListas, invitados y eventos reconstruidos correctamente",

        events: events.length,

        attenders: totalAttenders,

        arrives: totalArrives,

        biListasDeleted:
            deleted.deletedCount,

        biListasCreated:
            biListas.length,

        guestsUpdated:
            guestStats.length,

        eventsUpdated:
            eventStats.length,

        eventsReset:
            eventsWithoutAttenders.length,
    });
};