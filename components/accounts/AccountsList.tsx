"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { GrGroup } from "react-icons/gr";

import {
    FaPlus,
    FaUserPen,
    FaTrash,
    FaRotateLeft,
    FaStar,
} from "react-icons/fa6";
import { MdOutlineSelfImprovement } from "react-icons/md";

import DeleteAccountModal from "../modals/DeleteAccountModal";
import Loader from "../prefabs/Loader";

interface Account {
    _id: string;
    email: string;
    name: string;
    role: "ADMINISTRADOR" | "PORTERIA" | "NEO" | "ELIMINADO" | "LISTERO" | "LISTERO_PRO";
}

export default function AccountsList() {

    const router = useRouter();
    const { data: session } = useSession();

    const role = session?.user?.role;

    const isAdmin = role === "ADMINISTRADOR";

    const [deletedAccounts, setDeletedAccounts] = useState(false);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDeleteAccountModal, setShowDeleteAccountModal] = useState<{
        id: string | null,
        name?: string,
    }>({
        id: null
    });

    async function loadAccounts(deleted: boolean) {
        setLoading(true);
        const res = await fetch(`/api/accounts${deleted ? '?deleted=true' : ''}`);
        console.log("res", res);
        if (res.ok) {
            const resp = await res.json();
            console.log("ACCOUNTS", resp);
            setAccounts(resp.accounts);
        }
        setLoading(false);
    }

    const toggleDeletedAccounts = () => {
        setDeletedAccounts(!deletedAccounts);
        loadAccounts(!deletedAccounts);
    }

    const onDeleteConfirm = async (id: string) => {
        await fetch(`/api/accounts/${id}`, {
            method: "DELETE",
        });

        loadAccounts(deletedAccounts);
        setShowDeleteAccountModal({ id: null });
    }

    async function handleDeteleAccount(id: string, name: string) {
        setShowDeleteAccountModal({
            id, name
        });
    }

    useEffect(() => {
        loadAccounts(false);
    }, []);

    return (
        <div className="w-full h-screen overflow-y-scroll">
            <div className="max-w-6xl mx-auto px-6 py-8">

                <div className="flex flex-col items-end space-y-3 mb-8 w-full md:flex-row md:items-center md:justify-between md:space-y-0 md:space-x-3">
                    <h1 className="flex gap-3 text-3xl font-bold text-white text-nowrap">
                        <span className="text-cyan-400">
                            <GrGroup size={36} />
                        </span>
                        Cuentas
                    </h1>
                    {isAdmin && (

                        <button
                            onClick={() => router.push("/accounts/")}
                            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-semibold flex items-center gap-2 text-xl"
                        >
                            <FaPlus />
                            Nueva cuenta
                        </button>

                    )}
                </div>



                <div className="flex flex-wrap gap-2 mb-8">
                    <Tab
                        text="Eliminados"
                        active={deletedAccounts}
                        onClick={toggleDeletedAccounts}
                    />
                </div>

                {loading && (
                    <Loader text="Cargando usuarios..." />
                )}

                {!loading && accounts.length === 0 && (
                    <div className="rounded-xl bg-white/5 p-6 text-center text-gray-400">
                        No hay usuarios.
                    </div>
                )}

                <div className="w-full space-y-5">

                    {accounts.map((account, index) => (

                        <div
                            key={account._id}
                            className="w-full rounded-xl bg-white/5 border border-cyan-400/20 p-5 backdrop-blur"
                        >

                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-0">

                                <div>
                                    <div className="flex text-2xl text-gray-400">
                                        <span className="mt-1 mr-2">{index + 1}. </span>
                                        <span className="text-3xl font-semibold text-white">{account.name}</span>
                                        {account.role === "ADMINISTRADOR" && (
                                            <FaStar className="text-yellow-400" />
                                        )}
                                        {account.role === "LISTERO_PRO" && (
                                           <> <MdOutlineSelfImprovement size={34} className="text-yellow-400" /><span className="text-xs text-yellow-400">PRO</span></>
                                        )}
                                    </div>

                                    <div className="text-cyan-200">
                                        {account.email}
                                    </div>
                                </div>

                                {isAdmin && (

                                    <div className="flex items-end justify-end gap-2 self-end md:self-auto">
                                        <button
                                            onClick={() => router.push(`/accounts/${account._id}`)}
                                            className="w-22 text-center border-2 rounded-2xl border-blue-400 p-4 hover:bg-blue-900"
                                        >
                                            <FaUserPen size={32} className="text-blue-500 mx-auto" />
                                            <span>Editar</span>
                                        </button>


                                        <button
                                            onClick={() => handleDeteleAccount(account._id, account.name)}
                                            className="w-28 text-center border-2 rounded-2xl border-green-400 p-4"
                                        >
                                            {deletedAccounts ? <><FaRotateLeft size={32} className="text-red-green mx-auto" /><span>Reintegrar</span></>
                                                : <><FaTrash size={32} className="text-red-600 mx-auto" /><span>Eliminar</span></>}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                <DeleteAccountModal
                    show={showDeleteAccountModal.id !== null}
                    onClose={() => { setShowDeleteAccountModal({ id: null }) }}
                    isPending={loading}
                    onConfirm={() => onDeleteConfirm(showDeleteAccountModal.id || "")}
                    deleteAccount={!deletedAccounts}
                    userName={showDeleteAccountModal.name ?? ""} />
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