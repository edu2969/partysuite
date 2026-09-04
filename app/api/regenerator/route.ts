import { auth } from "@/app/utils/auth";
import { connectMongoDB } from "@/lib/mongodb";
import { NextResponse } from "next/server";

import Event from "@/models/event";
import Attender from "@/models/attender";
import Guest from "@/models/guest";
import BILista from "@/models/biLista";

export async function GET() {
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

        await connectMongoDB();

        const [events, attenders, guests, BIListas] =
            await Promise.all([
                Event.deleteMany({}),
                Attender.deleteMany({}),
                Guest.deleteMany({}),
                BILista.deleteMany({}),
            ]);

        return NextResponse.json({
            ok: true,
            message: "Datos reseteados correctamente",
            deleted: {
                events: events.deletedCount,
                attenders: attenders.deletedCount,
                guests: guests.deletedCount,
                BIListas: BIListas.deletedCount,
            },
        });

    } catch (error) {

        console.error("GET /api/reset:", error);

        return NextResponse.json(
            {
                ok: false,
                error: "Error al resetear los datos",
            },
            { status: 500 }
        );
    }
}