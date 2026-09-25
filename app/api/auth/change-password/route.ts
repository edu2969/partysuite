import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { auth } from "@/app/utils/auth";
import { connectMongoDB } from "@/lib/mongodb";
import User from "@/models/user";

interface ChangePasswordRequest {
    password: string;
}

export async function POST(
    request: NextRequest
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    error: "Sesión no válida",
                },
                { status: 401 }
            );
        }

        const body: ChangePasswordRequest =
            await request.json();

        const password =
            body.password?.trim();

        if (!password) {
            return NextResponse.json(
                {
                    error:
                        "La contraseña es requerida.",
                },
                { status: 400 }
            );
        }

        if (password.length < 8) {
            return NextResponse.json(
                {
                    error:
                        "La contraseña debe tener al menos 8 caracteres.",
                },
                { status: 400 }
            );
        }

        await connectMongoDB();

        const user = await User.findById(
            session.user.id
        );

        if (!user) {
            return NextResponse.json(
                {
                    error: "Usuario no encontrado.",
                },
                { status: 404 }
            );
        }

        const hashedPassword =
            await bcrypt.hash(password, 10);

        user.password = hashedPassword;
        user.changedAt = new Date();

        await user.save();

        return NextResponse.json({
            ok: true,
            message:
                "Contraseña actualizada correctamente.",
        });
    } catch (error) {
        console.error(
            "POST /api/auth/change-password:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "No fue posible cambiar la contraseña.",
            },
            { status: 500 }
        );
    }
}