import { NextRequest, NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import Event from "@/models/event";
import Attender from "@/models/attender";
import BIRP from "@/models/birp";
import User from "@/models/user";
import { auth } from "@/app/utils/auth";

export async function GET(
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

    if (
      session.user.role !== "ADMINISTRADOR" &&
      session.user.role !== "LISTERO"
    ) {
      return NextResponse.json(
        {
          message: "No tiene permisos para consultar BI",
        },
        { status: 403 }
      );
    }

    const { eventId } = await params;
    const { searchParams } = new URL(request.url);
    const desdeParam = searchParams.get("desde");
    const hastaParam = searchParams.get("hasta");

    await connectMongoDB();

    const allowedRoles = ["ADMINISTRADOR", "LISTERO", "PORTERIA"];
    const rpIds = await User.find({ role: { $in: allowedRoles } })
      .select("_id")
      .lean();

    const rpIdList = rpIds.map((user) => user._id);

    if (desdeParam || hastaParam) {
      const desde = desdeParam ? new Date(desdeParam) : new Date(0);
      const hasta = hastaParam ? new Date(hastaParam) : new Date();

      if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) {
        return NextResponse.json(
          {
            message: "Parámetros de fecha inválidos",
          },
          { status: 400 }
        );
      }

      const eventos = await Event.find({
        date: {
          $gte: desde,
          $lte: hasta,
        },
      })
        .select("_id")
        .lean();

      const eventoIds = eventos.map((evento) => evento._id);

      const birps = await BIRP.find({
        eventoId: { $in: eventoIds },
        rpId: { $in: rpIdList },
        asisten: { $gt: 0 },
      })
        .populate("rpId", "name email role")
        .lean();

      return NextResponse.json(birps);
    }

    const query: Record<string, unknown> = {
      asisten: { $gt: 0 },
      rpId: { $in: rpIdList },
    };

    if (eventId && eventId !== "all") {
      query.eventoId = eventId;
    }

    const birps = await BIRP.find(query)
      .populate("rpId", "name email role")
      .lean();

    return NextResponse.json(birps);
  } catch (error) {
    console.error("GET /api/events/[eventId]/bi:", error);

    return NextResponse.json(
      {
        message: "Error al obtener los datos BI",
      },
      { status: 500 }
    );
  }
}

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

    if (session.user.role !== "ADMINISTRADOR" && session.user.role !== "LISTERO") {
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