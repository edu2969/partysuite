import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import User from "@/models/user";
import { connectMongoDB } from "@/lib/mongodb";
import { auth } from "@/app/utils/auth";

// =========================
// TYPES
// =========================

const ALLOWED_ROLES = ["ADMINISTRADOR", "LISTERO", "LISTERO_PRO"] as const;
const DELETED_ROLE = "ELIMINADO";

// =========================
// HELPERS
// =========================

function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "10", 10)));
  return { page, pageSize };
}

async function queryAccounts({
  deleted,
  q,
  page,
  pageSize,
}: {
  deleted: boolean;
  q: string;
  page: number;
  pageSize: number;
}) {
  const roleFilter = deleted
    ? { role: DELETED_ROLE }
    : { role: { $in: ALLOWED_ROLES } };

  const textFilter = q
    ? {
        $or: [
          { name: { $regex: q, $options: "i" } },
          { email: { $regex: q, $options: "i" } },
        ],
      }
    : {};

  const filter = { ...roleFilter, ...textFilter };
  const skip = (page - 1) * pageSize;

  const [accounts, total] = await Promise.all([
    User.find(filter).skip(skip).limit(pageSize).lean(),
    User.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return {
    accounts,
    page,
    totalPages,
    hasMore: page < totalPages,
  };
}

// =========================
// GET
// =========================

export async function GET(req: NextRequest) {
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
      session.user.role !== "NEO"
    ) {
      return NextResponse.json(
        { message: "No tiene permisos para ver cuentas" },
        { status: 403 }
      );
    }

    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q") ?? "";
    const deleted = searchParams.get("deleted") === "true";
    const { page, pageSize } = parsePagination(searchParams);

    await connectMongoDB();

    const result = await queryAccounts({ deleted, q, page, pageSize });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/accounts:", error);

    return NextResponse.json(
      { message: "Error al obtener cuentas" },
      { status: 500 }
    );
  }
}

// =========================
// POST
// =========================

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "No autenticado" },
        { status: 401 }
      );
    }

    if (session.user.role !== "ADMINISTRADOR") {
      return NextResponse.json(
        { message: "No tiene permisos para crear cuentas" },
        { status: 403 }
      );
    }

    const { name, email, password, role, maxAttendersByEvent } = await req.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { message: "Datos incompletos" },
        { status: 400 }
      );
    }

    await connectMongoDB();

    const exists = await User.findOne({ email });

    if (exists) {
      return NextResponse.json(
        { message: "Ya existe un usuario con ese email." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      password: passwordHash,
      role,
      maxAttendersByEvent,
    });

    return NextResponse.json({ ok: true, id: user._id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/accounts:", error);

    return NextResponse.json(
      { message: "Error al crear cuenta" },
      { status: 500 }
    );
  }
}