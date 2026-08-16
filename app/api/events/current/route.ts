import { auth } from "@/app/utils/auth";
import { connectMongoDB } from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";
import Event from "@/models/event"

export async function GET(req: NextRequest) {

    const session = await auth();

    if (
        !session?.user ||
        session.user.role !== "PORTERIA"
    ) {
        return NextResponse.json(
            {
                ok: false,
                error: "No autorizado",
            },
            { status: 401 }
        );
    }

    await connectMongoDB();

    const now = new Date();

    // 00:00:00.000 de hoy
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    // 00:00:00.000 de mañana
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const events = await Event.find({
        date: {
            $gte: startOfDay,
            $lt: endOfDay,
        },
    })
        .sort({ date: -1 })
        .lean();

    const event = events.find((event) => {

        // Si no tiene cierre, lo consideramos vigente
        if (event.closeTime == null) {
            return true;
        }

        // closeTime = milisegundos desde las 00:00
        const closeDate = new Date(
            endOfDay.getTime() + event.closeTime
        );

        return now.getTime() <= closeDate.getTime();
    });

    if (!event) {
        return NextResponse.json({
            ok: true,
            event: null,
            message: "No existe un evento vigente para hoy",
        });
    }

    return NextResponse.json({
        ok: true,
        event,
    });
}