import { NextRequest, NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import Event from "@/models/event";
import Attender from "@/models/attender";
import BILista from "@/models/biLista";
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

    const allowedRoles = ["ADMINISTRADOR", "LISTERO", "LISTERO_PRO", "PORTERIA"];
    const listeroIds = await User.find({ role: { $in: allowedRoles } })
      .select("_id")
      .lean();

    const listerosIdList = listeroIds.map((user) => user._id);

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

      const BIListas = await BILista.find({
        eventId: { $in: eventoIds },
        userId: { $in: listerosIdList },
        asisten: { $gt: 0 },
      })
        .populate("userId", "name email role")
        .lean();

      return NextResponse.json(BIListas);
    }

    const query: Record<string, unknown> = {
      asisten: { $gt: 0 },
      userId: { $in: listerosIdList },
    };

    if (eventId && eventId !== "all") {
      query.eventId = eventId;
    }

    const BIListas = await BILista.find(query)
      .populate("userId", "name email role")
      .lean();

    return NextResponse.json(BIListas);
  } catch (error) {
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

    if (session.user.role !== "ADMINISTRADOR" && session.user.role !== "LISTERO"
      && session.user.role !== "LISTERO_PRO"
    ) {
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

    const event = await Event.findById(eventId);

    if (!event) {
      return NextResponse.json(
        {
          message: "Evento no encontrado",
        },
        { status: 404 }
      );
    }

    await BILista.deleteMany({
      eventId: eventId,
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
      const userId =
        attender.userId.toString();

      const current =
        biMap.get(userId) || {
          inscritos: 0,
          asisten: 0,
        };

      current.inscritos++;

      if (attender.checktime) {
        current.asisten++;
        arrives++;
      }

      biMap.set(
        userId,
        current
      );

      total++;
    }

    await BILista.insertMany(
      Array.from(biMap.entries()).map(
        ([userId, values]) => ({
          eventId: eventId,
          userId,
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
      listeros: biMap.size,
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