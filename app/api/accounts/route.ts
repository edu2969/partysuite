import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import User from "@/models/user";
import { connectMongoDB } from "@/lib/mongodb";
import { auth } from "@/app/utils/auth";

export async function GET(req: NextRequest) {
    const session = await auth();
    if(!session || (session.user?.role !== "ADMINISTRADOR" 
        && session.user?.role !== "NEO")
    ) {
        return NextResponse.json({ ok: false, error: "No session" });
    }
    const deleted = req.nextUrl.searchParams.get("deleted");

    await connectMongoDB();
    const users = await User.find({ role: deleted ? 'ELIMINADO' : { $in: ["ADMINISTRADOR", "LISTERO", "LISTERO_PRO"] } });

    return NextResponse.json({ accounts: users });
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if(!session || session.user?.role !== "ADMINISTRADOR") {
        return NextResponse.json({ ok: false, error: "No session" });
    }
    await connectMongoDB();

    const {
        name,
        email,
        password,
        role,
        maxAttendersByEvent
    } = await req.json();

    if (!name || !email || !password || !role) {
        return NextResponse.json(
            { message: "Datos incompletos" },
            { status: 400 }
        );
    }

    const exists = await User.findOne({ email });

    if (exists) {
        return NextResponse.json(
            { message: "Ya existe un usuario con ese username o email." },
            { status: 409 }
        );

    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
        name,
        email,
        password: passwordHash,
        role,
        maxAttendersByEvent
    });

    return NextResponse.json({
        ok: true,
        id: user._id,
    });

}