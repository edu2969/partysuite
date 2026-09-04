import { NextRequest, NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import { auth } from "@/app/utils/auth";
import User from "@/models/user";
import mongoose from "mongoose";
import { isAccountRole } from "@/app/utils/isAccountRole";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ accountId: string }> }) {
    await connectMongoDB();
    const session = await auth();
    if(!session || !session.user || !["ADMINISTRADOR", "NEO"].includes(session.user?.role ?? "")) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 303 });
    }
    const { accountId } = await params;    
    const user = await User.findById(accountId).lean();
    return NextResponse.json({ ok: true, account: user }, { status: 200 });
}

const SALT_ROUNDS = 10;
 
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  // --- Autenticación / autorización ---
  // Mismo check que ya hace la página — se repite acá porque el route es
  // el que realmente decide qué se puede escribir en la base de datos.
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const userRole = session.user.role;
  if (userRole !== "ADMINISTRADOR" && userRole !== "NEO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
 
  const { accountId } = await params;
 
  if (!mongoose.Types.ObjectId.isValid(accountId)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }
 
  // --- Body ---
  const body = await request.json().catch(() => null);
 
  const name = body?.name;
  const email = body?.email;
  const role = body?.role;
  const maxAttendersByEvent = body?.maxAttendersByEvent;
  const password: string | undefined = body?.password || undefined; // "" o undefined → no se toca

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "'name' es requerido" }, { status: 400 });
  }
 
  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "'email' es requerido" }, { status: 400 });
  }
 
  if (!isAccountRole(role)) {
    return NextResponse.json({ error: "'role' inválido" }, { status: 400 });
  }
 
  await connectMongoDB();
 
  // --- $set dinámico: password solo entra si vino en el body ---
  const update: Record<string, unknown> = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role,
    maxAttendersByEvent
  };
 
  if (password) {
    update.password = await bcrypt.hash(password, SALT_ROUNDS);
  }
 
  try {
    const updated = await User.findByIdAndUpdate(
      accountId,
      { $set: update },
      { new: true, runValidators: true }
    );
    // no hace falta .select("-password"): el schema ya tiene select:false en password
 
    if (!updated) {
      return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err: unknown) {
    // índice único de email (o username) violado
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 11000) {
      return NextResponse.json({ error: "El email ya está en uso" }, { status: 409 });
    }
 
    console.error("Error al actualizar la cuenta", err);
    return NextResponse.json({ error: "Error al actualizar la cuenta" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  // --- Autenticación / autorización ---
  // Mismo check que el PUT — se repite acá porque el route es
  // el que realmente decide qué se puede borrar en la base de datos.
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const userRole = session.user.role;
  if (userRole !== "ADMINISTRADOR" && userRole !== "NEO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { accountId } = await params;

  if (!mongoose.Types.ObjectId.isValid(accountId)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  // Evita que un admin se borre a sí mismo por accidente y quede sin acceso
  if (session.user.id === accountId) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propia cuenta" },
      { status: 400 }
    );
  }

  await connectMongoDB();

  try {
    const user = await User.findById(accountId);
    const deleted = user.role === "ELIMINADO";    
    await User.findByIdAndUpdate(accountId, { 
      role: deleted ? { $in: ["LISTERO", "LISTERO_PRO"] } : "ELIMINADO"
    });
    return NextResponse.json({ success: true, deletedId: accountId });
  } catch (err: unknown) {
    console.error("Error al eliminar la cuenta", err);
    return NextResponse.json({ error: "Error al eliminar la cuenta" }, { status: 500 });
  }
}

