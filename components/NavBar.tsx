"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

import {
    FaBars,
    FaXmark,
    FaHouse,
    FaCalendarDays,
    FaPlus,
    FaUsers,
    FaGear,
    FaChartColumn,
    FaScrewdriverWrench,
    FaRightFromBracket,
} from "react-icons/fa6";

export default function TopNavigator() {

    const [menuActivo, setMenuActivo] = useState(false);

    const { data: session } = useSession();

    const router = useRouter();
    const pathname = usePathname();

    const isAdmin = session?.user?.role === "ADMINISTRADOR";
    const isRPAdmin = isAdmin || session?.user?.role === "ADMINISTRADOR";

    return (
        <>

            {/* Barra Superior */}

            <div className={`fixed top-0 left-0 z-50 ${pathname === "/" ? "hidden" : ""}`}>

                <div className="flex items-center justify-between bg-transparent p-4">

                    <FaBars
                        size={28}
                        className="text-cyan-300 cursor-pointer hover:text-white transition"
                        onClick={() => setMenuActivo(true)}
                    />                   

                </div>

            </div>

            {/* Panel lateral */}

            <div
                className={`
                    fixed
                    top-0
                    left-0
                    h-screen
                    w-90
                    z-100
                    transition-transform
                    duration-300
                    ${menuActivo ? "translate-x-0" : "-translate-x-full"}
                `}
            >

                <Image
                    src="/panel/marco_001.png"
                    alt="Marco"
                    fill
                    priority
                    className="object-fill pointer-events-none select-none"
                />

                <div className="relative h-full p-8">

                    <FaXmark
                        size={34}
                        className="absolute top-8 right-8 cursor-pointer text-cyan-300 hover:text-white"
                        onClick={() => setMenuActivo(false)}
                    />

                    <div className="mt-16 space-y-2 text-cyan-300">

                        {/* Eventos */}

                        <MenuItem
                            href="/events"
                            icon={<FaCalendarDays size={26} />}
                            text="Eventos"
                            close={() => setMenuActivo(false)}
                        />

                        {/* Crear Evento */}

                        {isRPAdmin && (

                            <MenuItem
                                href="/events/new"
                                icon={<FaPlus size={26} />}
                                text="Nuevo Evento"
                                close={() => setMenuActivo(false)}
                            />

                        )}

                        {/* Administración */}

                        {isRPAdmin && (

                            <MenuItem
                                href="/manager"
                                icon={<FaGear size={26} />}
                                text="Administración"
                                close={() => setMenuActivo(false)}
                            />

                        )}

                        {/* Invitados */}

                        {isRPAdmin && (

                            <MenuItem
                                href="/guests"
                                icon={<FaUsers size={26} />}
                                text="Invitados"
                                close={() => setMenuActivo(false)}
                            />

                        )}

                        {/* BI */}

                        {isRPAdmin && (

                            <MenuItem
                                href="/business-intelligence"
                                icon={<FaChartColumn size={26} />}
                                text="Dashboards"
                                close={() => setMenuActivo(false)}
                            />

                        )}

                        {/* Mantención */}

                        {isAdmin && (

                            <MenuItem
                                href="/maintenance"
                                icon={<FaScrewdriverWrench size={26} />}
                                text="Mantención"
                                close={() => setMenuActivo(false)}
                            />

                        )}

                    </div>

                    {/* Logout */}

                    <button
                        className="
                            absolute
                            bottom-10
                            left-28
                            flex
                            items-center
                            gap-3
                            rounded-lg
                            p-3
                            text-cyan-300
                            hover:bg-cyan-400/10
                            hover:text-white
                            transition
                        "
                        onClick={async () => {

                            setMenuActivo(false);

                            await signOut({
                                redirect: false
                            });

                            router.push("/login");

                        }}
                    >

                        <FaRightFromBracket size={24} />

                        <span className="text-xl">
                            Cerrar sesión
                        </span>

                    </button>

                </div>

            </div>

        </>
    );

}

interface MenuItemProps {
    href: string;
    text: string;
    icon: React.ReactNode;
    close: () => void;
}

function MenuItem({
    href,
    text,
    icon,
    close
}: MenuItemProps) {

    return (

        <Link
            href={href}
            onClick={close}
        >

            <div
                className="
                    flex
                    items-center
                    gap-4
                    rounded-xl
                    px-4
                    py-3
                    hover:bg-cyan-400/10
                    hover:text-white
                    transition-all
                "
            >

                {icon}

                <span className="text-2xl">
                    {text}
                </span>

            </div>

        </Link>

    );

}