"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import {
    FaPlus,
    FaUser,
    FaUserPen,
    FaTrash,
    FaRotateLeft,
    FaStar,
} from "react-icons/fa6";

interface Account {
    _id: string;
    username: string;
    email: string;
    name: string;
    role: "ADMINISTRADOR" | "PORTERIA" | "NEO" | "ELIMINADO";
}

export default function AccountsList() {

    const router = useRouter();
    const { data: session } = useSession();

    const role = Number(session?.user?.role ?? 0);

    const isAdmin = role === 1;
    const isRPAdmin = isAdmin || session?.user?.role === "ADMINISTRADOR";

    const [roleSelected, setRoleSelected] = useState("EMBAJADOR");
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAccounts();
    }, [roleSelected]);

    async function loadAccounts() {

        setLoading(true);

        const res = await fetch(`/api/accounts?role=${roleSelected}`);

        if (res.ok) {
            const resp = await res.json();
            console.log("ACCOUNTS", resp);
            setAccounts(resp.accounts);
        }

        setLoading(false);

    }

    async function eliminar(id: string) {

        if (!confirm("¿Eliminar usuario?")) return;

        await fetch(`/api/accounts/${id}`, {
            method: "DELETE",
        });

        loadAccounts();

    }

    async function reintegrar(id: string) {

        await fetch(`/api/accounts/${id}/restore`, {
            method: "POST",
        });

        loadAccounts();

    }

    return (

        <div className="max-w-6xl mx-auto px-6 py-8">

            <div className="flex justify-between items-center mb-6">

                <h1 className="text-3xl font-bold text-cyan-300 flex items-center gap-3">
                    <FaUser />
                    Cuentas
                </h1>

                {isRPAdmin && (

                    <button
                        onClick={() => router.push("/accounts/")}
                        className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-semibold flex items-center gap-2"
                    >
                        <FaPlus />
                        Usuario
                    </button>

                )}

            </div>

            <div className="flex flex-wrap gap-2 mb-8">

                {isAdmin && (

                    <>
                        <Tab
                            text="Administradores"
                            active={roleSelected === "ADMINISTRADOR"}
                            onClick={() => setRoleSelected("ADMINISTRADOR")}
                        />

                        <Tab
                            text="Embajadores"
                            active={roleSelected === "EMBAJADOR"}
                            onClick={() => setRoleSelected("EMBAJADOR")}
                        />

                        <Tab
                            text="Portería"
                            active={roleSelected === "PORTERIA"}
                            onClick={() => setRoleSelected("PORTERIA")}
                        />
                    </>

                )}

                <Tab
                    text="Eliminados"
                    active={roleSelected === "ELIMINADO"}
                    onClick={() => setRoleSelected("ELIMINADO")}
                />

            </div>

            {loading && (

                <div className="text-center text-cyan-300">
                    Cargando...
                </div>

            )}

            {!loading && accounts.length === 0 && (

                <div className="rounded-xl bg-white/5 p-6 text-center text-gray-400">
                    No hay usuarios.
                </div>

            )}

            <div className="space-y-5">

                {accounts.map((account, index) => (

                    <div
                        key={account._id}
                        className="rounded-xl bg-white/5 border border-cyan-400/20 p-5 backdrop-blur"
                    >

                        <div className="flex justify-between">

                            <div>
                                <div className="flex text-2xl text-gray-400 space-x-2">
                                    <span className="mt-1">{index + 1}. </span>
                                    <span className="text-3xl font-semibold text-white">{account.name}</span>
                                    {account.role === "ADMINISTRADOR" && (
                                        <FaStar className="text-yellow-400" />
                                    )}                                    
                                </div>

                                <h2 className="text-xl font-semibold text-white mt-1 flex items-center gap-2">
                                    
                                </h2>
                                <div className="text-cyan-200">
                                    {account.email}
                                </div>
                            </div>

                            {isRPAdmin && (

                                <div className="flex items-start gap-2">
                                    <button
                                        onClick={() => router.push(`/accounts/${account._id}`)}
                                        className="w-22 text-center border-2 rounded-2xl border-blue-400 p-4 hover:bg-blue-900"
                                    >
                                        <FaUserPen size={32} className="text-blue-500 mx-auto" />
                                        <span>Editar</span>
                                    </button>

                                    {roleSelected === "ELIMINADO" ? (
                                        <button
                                            onClick={() => reintegrar(account._id)}
                                            className="w-22 text-center border-2 rounded-2xl border-green-400 p-4"
                                        >
                                            <FaRotateLeft size={32} className="text-red-green mx-auto" />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => eliminar(account._id)}
                                            className="w-22 text-center border-2 rounded-2xl border-red-400 p-4"
                                        >
                                            <FaTrash size={32} className="text-red-600 mx-auto" />
                                            <span>Eliminar</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

}

interface TabProps {
    text: string;
    active: boolean;
    onClick: () => void;
}

function Tab({
    text,
    active,
    onClick,
}: TabProps) {

    return (

        <button
            onClick={onClick}
            className={`
                px-5
                py-2
                rounded-lg
                transition
                ${active
                    ? "bg-cyan-500 text-black font-semibold"
                    : "bg-white/10 text-gray-300 hover:bg-white/20"}
            `}
        >

            {text}

        </button>

    );

}