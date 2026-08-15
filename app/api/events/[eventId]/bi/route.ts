import { NextRequest, NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import Event from "@/models/event";
import Attender from "@/models/attender";
import BIRP from "@/models/birp";
import { auth } from "@/app/utils/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "No autenticado" },
        { status: 401 }
      );
    }

    if (session.user.role !== "ADMINISTRADOR" && session.user.role !== "EMBAJADOR") {
      return NextResponse.json(
        {
          message:
            "No tiene permisos para generar BI",
        },
        { status: 403 }
      );
    }

    const { eventId } = await params;

    await connectMongoDB();

    const event =
      await Event.findById(eventId);

    if (!event) {
      return NextResponse.json(
        {
          message: "Evento no encontrado",
        },
        { status: 404 }
      );
    }

    await BIRP.deleteMany({
      eventoId: eventId,
    });

    const attenders =
      await Attender.find({
        eventId: eventId,
      }).lean();

    const biMap = new Map<
      string,
      {
        inscritos: number;
        asisten: number;
      }
    >();

    let total = 0;
    let arrives = 0;

    for (const attender of attenders) {
      const rpId =
        attender.rpId.toString();

      const current =
        biMap.get(rpId) || {
          inscritos: 0,
          asisten: 0,
        };

      current.inscritos++;

      if (attender.checktime) {
        current.asisten++;
        arrives++;
      }

      biMap.set(
        rpId,
        current
      );

      total++;
    }

    await BIRP.insertMany(
      Array.from(biMap.entries()).map(
        ([rpId, values]) => ({
          eventoId: eventId,
          rpId,
          inscritos: values.inscritos,
          asisten: values.asisten,
        })
      )
    );

    await Event.updateOne(
      {
        _id: eventId,
      },
      {
        $set: {
          total,
          arrives,
        },
      }
    );

    return NextResponse.json({
      success: true,
      total,
      arrives,
      rps: biMap.size,
    });
  } catch (error) {
    console.error(
      "POST /api/events/[eventId]/bi:",
      error
    );

    return NextResponse.json(
      {
        message:
          "Error al generar BI",
      },
      { status: 500 }
    );
  }
}