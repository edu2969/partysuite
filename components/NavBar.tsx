"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

import {
    FaBars,
    FaXmark,
    FaCalendarDays,
    FaGear,
    FaChartColumn,
    FaScrewdriverWrench,
    FaRightFromBracket,
    FaStar,
} from "react-icons/fa6";
import { BiSolidInvader } from "react-icons/bi";
import { TbGhost2Filled } from "react-icons/tb";

export default function TopNavigator() {

    const [menuActivo, setMenuActivo] = useState(false);

    const { data: session } = useSession();

    const router = useRouter();
    const pathname = usePathname();

    const isAdmin = session?.user?.role === "ADMINISTRADOR";
    const isNeo = session?.user.role === "NEO";

    return (
        <>

            {/* Barra Superior */}

            {!menuActivo && <div className={`fixed top-0 left-0 z-50 ${pathname === "/" ? "hidden" : ""}`}>

                <div className="flex items-center justify-between bg-transparent p-4">

                    <FaBars
                        size={28}
                        className="text-cyan-300 cursor-pointer hover:text-white transition"
                        onClick={() => setMenuActivo(true)}
                    />                   

                </div>

            </div>}

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
                    sizes="360px"
                    className="object-fill pointer-events-none select-none py-10"
                />

                <div className="relative h-full p-8">

                    <FaXmark
                        size={34}
                        className="absolute top-20 right-8 cursor-pointer text-cyan-300 hover:text-white"
                        onClick={() => setMenuActivo(false)}
                    />

                    <div className="mt-24 space-y-2 text-cyan-300">

                        <div className="relative mb-6 flex flex-col items-center justify-center gap-3">
                            <div
                                className="
                                    flex h-20 w-20 items-center justify-center
                                    rounded-full border border-cyan-300 bg-cyan-500/10
                                    text-3xl font-bold leading-none tracking-[0.08em]
                                    text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.35)]
                                "
                                aria-label="Iniciales del usuario"
                            >
                                {(() => {
                                    const userName = session?.user?.name || "Usuario";
                                    const initials = userName
                                        .split(/\s+/)
                                        .filter(Boolean)
                                        .map((part) => part[0]?.toUpperCase() ?? "")
                                        .join("")
                                        .slice(0, 2);

                                    return initials || "U";
                                })()}
                            </div>

                            <span className="flex text-xl font-medium text-cyan-200 text-center">
                                {session?.user?.name || "Usuario"}
                                {isAdmin && (<div className="ml-1">
                                    <FaStar className="text-sm text-yellow-400" />
                                </div>)}
                                {isNeo && (<div className="ml-1">
                                    <BiSolidInvader className="text-3xl text-green-400" />
                                </div>)} 
                            </span>                            
                        </div>

                        {/* Eventos */}

                        <MenuItem
                            href="/events"
                            icon={<FaCalendarDays size={26} />}
                            text="Eventos"
                            close={() => setMenuActivo(false)}
                        />

                        {/* Administración */}

                        {isAdmin && (

                            <MenuItem
                                href="/manager"
                                icon={<FaGear size={26} />}
                                text="Cuentas"
                                close={() => setMenuActivo(false)}
                            />

                        )}

                        {/* BI */}

                        {isAdmin && (

                            <MenuItem
                                href="/stats"
                                icon={<FaChartColumn size={26} />}
                                text="Dashboards"
                                close={() => setMenuActivo(false)}
                            />

                        )}

                        {/* Mantención */}

                        {isNeo && (

                            <MenuItem
                                href="/maintenance"
                                icon={<FaScrewdriverWrench size={26} />}
                                text="Mantención"
                                close={() => setMenuActivo(false)}
                            />

                        )}

                        <MenuItem
                            href="/about"
                            icon={<TbGhost2Filled size={26} />}
                            text="Acerca de..."
                            close={() => setMenuActivo(false)}
                        />

                    </div>

                    {/* Logout */}

                    <button
                        className="
                            absolute
                            bottom-22
                            md:bottom-16
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