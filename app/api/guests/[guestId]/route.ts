import { NextRequest, NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import Guest from "@/models/guest";
import { auth } from "@/app/utils/auth";

interface RouteContext {
  params: Promise<{
    guestId: string;
  }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "No autenticado" },
        { status: 401 }
      );
    }

    const { guestId } = await context.params;
    await connectMongoDB();
    const guest = await Guest.findById(guestId).lean();

    if (!guest) {
      return NextResponse.json({ ok: false, error: "Invitado no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      guest,
    });
  } catch (error) {
    console.error(
      "GET /api/guests/[guestId]:",
      error
    );

    return NextResponse.json(
      {
        message:
          "Error obteniendo invitado",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "No autenticado" },
        { status: 401 }
      );
    }

    const canEdit =
      session.user.role === "ADMINISTRADOR" ||
      session.user.role === "LISTERO";

    if (!canEdit) {
      return NextResponse.json(
        {
          message:
            "No tiene permisos para editar invitados",
        },
        { status: 403 }
      );
    }

    const { guestId } =
      await context.params;

    const body = await request.json();

    const {
      names,
      gender,
      baneado,
      observacion,
    } = body;

    await connectMongoDB();

    const guest =
      await Guest.findByIdAndUpdate(
        guestId,
        {
          $set: {
            names,
            gender:
              gender === "F" ||
              gender === "M"
                ? gender
                : null,
            baneado: !!baneado,
            observacion:
              observacion || "",
          },
        },
        {
          new: true,
          runValidators: true,
        }
      ).lean();

    if (!guest) {
      return NextResponse.json(
        {
          message:
            "Invitado no encontrado",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      guest,
    });
  } catch (error) {
    console.error(
      "PUT /api/guests/[guestId]:",
      error
    );

    return NextResponse.json(
      {
        message:
          "Error guardando invitado",
      },
      { status: 500 }
    );
  }
}