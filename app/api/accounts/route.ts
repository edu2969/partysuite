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
    const role = req.nextUrl.searchParams.get("role");

    console.log("GET /api/accounts?role=", role);   

    await connectMongoDB();
    const users = await User.find({ role: role === "ELIMINADOS" ? 'ELIMINADOS' : { $in: ["ADMINISTRADOR", "EMBAJADOR"] } });

    return NextResponse.json({ accounts: users });
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if(!session || session.user?.role !== "ADMINISTRADOR") {
        return NextResponse.json({ ok: false, error: "No session" });
    }
    await connectMongoDB();

    const {
        username,
        name,
        email,
        password,
        role,
    } = await req.json();

    if (!username || !name || !email || !password || !role) {
        return NextResponse.json(
            { message: "Datos incompletos" },
            { status: 400 }
        );
    }

    const exists = await User.findOne({
        $or: [
            { username },
            { email }
        ]
    });

    if (exists) {
        return NextResponse.json(
            { message: "Ya existe un usuario con ese username o email." },
            { status: 409 }
        );

    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
        username,
        name,
        email,
        password: passwordHash,
        role
    });

    return NextResponse.json({
        ok: true,
        id: user._id,
    });

}