import { NextResponse } from "next/server";

import { auth } from "@/app/utils/auth";
import { connectMongoDB } from "@/lib/mongodb";
import User from "@/models/user";

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    authenticated: false,
                    required: false,
                },
                { status: 401 }
            );
        }

        await connectMongoDB();

        const user = await User.findById(
            session.user.id
        )
            .select("changedAt")
            .lean<{ changedAt?: Date }>();

        if (!user) {
            return NextResponse.json(
                {
                    authenticated: false,
                    required: false,
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            authenticated: true,
            required: !user.changedAt,
        });
    } catch (error) {
        console.error(
            "GET /api/auth/password-status:",
            error
        );

        return NextResponse.json(
            {
                authenticated: false,
                required: false,
            },
            { status: 500 }
        );
    }
}