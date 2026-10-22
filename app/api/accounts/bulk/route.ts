import { NextRequest, NextResponse } from "next/server";
import User from "@/models/user";
import { connectMongoDB } from "@/lib/mongodb";
import { auth } from "@/app/utils/auth";
import { isValidProImportTime } from "@/lib/eventClose";

// =========================
// TYPES
// =========================

const APPLIES_TO = ["LISTERO", "LISTERO_PRO", "BOTH"] as const;
type AppliesTo = (typeof APPLIES_TO)[number];

// =========================
// PATCH
// =========================

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ message: "No autenticado" }, { status: 401 });
    }

    if (
      session.user.role !== "ADMINISTRADOR" &&
      session.user.role !== "NEO"
    ) {
      return NextResponse.json(
        { message: "No tiene permisos para actualizar cuentas" },
        { status: 403 }
      );
    }

    const { maxAttendersByEvent, maxImportTime, appliesTo } = await req.json();

    if (!APPLIES_TO.includes(appliesTo)) {
      return NextResponse.json(
        { message: "Debe indicar a qué tipo de listero aplica" },
        { status: 400 }
      );
    }

    const amount = Number(maxAttendersByEvent);

    if (!Number.isInteger(amount) || amount < 1) {
      return NextResponse.json(
        { message: "La máxima cantidad de importación debe ser un entero mayor a 0" },
        { status: 400 }
      );
    }

    const target = appliesTo as AppliesTo;
    const includesPro = target === "LISTERO_PRO" || target === "BOTH";

    if (includesPro && !isValidProImportTime(maxImportTime)) {
      return NextResponse.json(
        { message: "La hora máxima debe ser posterior a las 23:30 o anterior a las 05:00" },
        { status: 400 }
      );
    }

    await connectMongoDB();

    let matched = 0;
    let modified = 0;

    if (target === "LISTERO" || target === "BOTH") {
      const result = await User.updateMany(
        { role: "LISTERO" },
        { $set: { maxAttendersByEvent: amount }, $unset: { maxImportTime: 1 } },
        { runValidators: true }
      );

      matched += result.matchedCount;
      modified += result.modifiedCount;
    }

    if (includesPro) {
      const result = await User.updateMany(
        { role: "LISTERO_PRO" },
        {
          $set: { maxAttendersByEvent: amount, maxImportTime },
        },
        { runValidators: true }
      );

      matched += result.matchedCount;
      modified += result.modifiedCount;
    }

    return NextResponse.json({ ok: true, matched, modified });
  } catch (error) {
    console.error("PATCH /api/accounts/bulk:", error);

    return NextResponse.json(
      { message: "Error al actualizar cuentas" },
      { status: 500 }
    );
  }
}
