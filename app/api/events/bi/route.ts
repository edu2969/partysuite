import { NextRequest, NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import Event from "@/models/event";
import BIRP from "@/models/birp";
import User from "@/models/user";
import { auth } from "@/app/utils/auth";

export async function GET(request: NextRequest) {
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
      session.user.role !== "EMBAJADOR"
    ) {
      return NextResponse.json(
        {
          message: "No tiene permisos para consultar BI",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const desdeParam = searchParams.get("desde");
    const hastaParam = searchParams.get("hasta");

    // A diferencia de /api/events/[eventId]/bi (donde desde/hasta son
    // opcionales sobre un eventId), acá el intervalo ES el input principal:
    // ambos son requeridos.
    if (!desdeParam || !hastaParam) {
      return NextResponse.json(
        { message: "Los parámetros 'desde' y 'hasta' son requeridos" },
        { status: 400 }
      );
    }

    const desde = new Date(desdeParam);
    const hasta = new Date(hastaParam);

    if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) {
      return NextResponse.json(
        { message: "Parámetros de fecha inválidos" },
        { status: 400 }
      );
    }

    await connectMongoDB();

    const allowedRoles = ["ADMINISTRADOR", "EMBAJADOR", "PORTERIA"];
    const rps = await User.find({ role: { $in: allowedRoles } })
      .select("_id")
      .lean();
    const rpIdList = rps.map((user) => user._id);

    const eventos = await Event.find({
      date: { $gte: desde, $lte: hasta },
    })
      .select("_id")
      .lean();

    const eventoIds = eventos.map((evento) => evento._id);

    if (eventoIds.length === 0) {
      return NextResponse.json([]);
    }

    // Cada BIRP está atado a UN evento (eventoId), así que para un rango de
    // varios eventos hay que sumar por RP a través de todos ellos — no
    // alcanza con traer los BIRP tal cual, como hace la rama desde/hasta
    // del route de un solo evento, porque ahí el mismo RP aparecería una
    // fila por cada evento en el que participó.
    const agregados = await BIRP.aggregate([
      {
        $match: {
          eventoId: { $in: eventoIds },
          rpId: { $in: rpIdList },
        },
      },
      {
        $group: {
          _id: "$rpId",
          inscritos: { $sum: "$inscritos" },
          asisten: { $sum: "$asisten" },
        },
      },
      // El filtro "solo RPs con asistencia" se aplica DESPUÉS de sumar, no
      // antes: un RP con asisten=0 en un evento pero >0 en otro del mismo
      // rango debe seguir apareciendo.
      { $match: { asisten: { $gt: 0 } } },
      {
        $lookup: {
          from: User.collection.name,
          localField: "_id",
          foreignField: "_id",
          as: "rp",
        },
      },
      { $unwind: "$rp" },
      {
        $project: {
          _id: "$rp._id",
          rpId: {
            _id: "$rp._id",
            name: "$rp.name",
            email: "$rp.email",
            role: "$rp.role",
          },
          inscritos: 1,
          asisten: 1,
        },
      },
      { $sort: { asisten: -1 } },
    ]);

    return NextResponse.json(agregados);
  } catch (error) {
    console.error("GET /api/events/bi:", error);

    return NextResponse.json(
      {
        message: "Error al obtener los datos BI",
      },
      { status: 500 }
    );
  }
}