import { NextRequest, NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import { auth } from "@/app/utils/auth";
import { parsePagination, queryAttenders } from "@/app/utils/attendersQuery";

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
      session.user.role !== "LISTERO" &&
      session.user.role !== "PORTERIA"
    ) {
      return NextResponse.json(
        { message: "No tiene permisos para ver asistentes" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const { page, pageSize } = parsePagination(searchParams);

    await connectMongoDB();

    const result = await queryAttenders({ q, page, pageSize });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/attenders:", error);

    return NextResponse.json(
      { message: "Error al obtener asistentes" },
      { status: 500 }
    );
  }
}