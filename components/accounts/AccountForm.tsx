"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FaSave, FaUserEdit } from "react-icons/fa";
import { FiLoader } from "react-icons/fi";

interface Account {
    _id?: string;
    name: string;
    email: string;
    role: "ADMINISTRADOR" | "PORTERIA" | "LISTERO" | "NEO" | "LISTERO_PRO" | "ELIMINADO",
    maxAttendersByEvent: number;
}

interface Props {
    accountId?: string;
    roleSelected: string;
}

interface FormData {
    name: string;
    username: string;
    email: string;
    password: string;
    repassword: string;
    isPro: boolean;
    maxAttendersByEvent: number;
}

async function fetchAccount(accountId: string): Promise<Account> {
    const resp = await fetch(`/api/accounts/${accountId}`, {
        cache: "no-store",
    });
    if (!resp.ok) throw new Error("No fue posible obtener la cuenta.");
    const response = await resp.json();
    return response.account;
}

// Nota: igual que el código original, esto NO revisa `resp.ok` en los PUT/POST
// de guardado (solo fallaría ante un error de red). Si quieres que un 4xx/5xx
// también dispare onError, agrega `if (!res.ok) throw new Error()` en cada uno.
async function saveAccount({
    accountId,
    account,
    data,
}: {
    accountId: string | null;
    account: Account | null;
    data: FormData;
}) {
    if (!account) {
        await fetch("/api/accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: data.name,
                email: data.email,
                role: data.isPro ? "LISTERO_PRO" : "LISTERO",
                password: data.password,
                maxAttendersByEvent: data.maxAttendersByEvent
            }),
        });
        return;
    }

    const payload: {
        _id: string | null;
        name: string;
        email: string;
        role: string;
        password?: string;
        maxAttendersByEvent: number;
    } = {
        _id: accountId,
        name: data.name,
        email: data.email,
        role: data.isPro ? "LISTERO_PRO" : "LISTERO",
        maxAttendersByEvent: data.maxAttendersByEvent
    };
    if (data.repassword) {
        payload.password = data.password;
    }

    await fetch(`/api/accounts/${account._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
}

export default function AccountForm({
    accountId,
    roleSelected,
}: Props) {
    const router = useRouter();
    const [error, setError] = useState("");
    const {
        register,
        handleSubmit,
        reset,
        watch
    } = useForm<FormData>({
        defaultValues: {
            name: "",
            email: "",
            password: "",
            repassword: "",
            isPro: false,
            maxAttendersByEvent: 0
        },
    });

    const {
        data: account,
        isPending: loading,
        isError: loadFailed,
    } = useQuery({
        queryKey: ["account", accountId],
        queryFn: () => fetchAccount(accountId as string),
        enabled: !!accountId,
    });

    const isProCheck = watch("isPro");

    // Rellena el formulario apenas llega la cuenta (reemplaza el `reset(...)`
    // que antes vivía dentro del mismo useEffect que hacía el fetch).
    useEffect(() => {
        if (!account) return;
        reset({
            name: account.name,
            email: account.email ?? "",
            password: "",
            repassword: "",
            isPro: account.role === "LISTERO_PRO",
            maxAttendersByEvent: account.maxAttendersByEvent
        });
    }, [account, reset]);

    useEffect(() => {
        if (loadFailed) setError("No fue posible obtener la cuenta.");
    }, [loadFailed]);

    const saveMutation = useMutation({
        mutationFn: (data: FormData) =>
            saveAccount({ accountId: accountId ?? null, account: account ?? null, data }),
        onSuccess: () => {
            router.push("/manager");
        },
        onError: () => {
            setError("No fue posible guardar la cuenta.");
        },
    });

    function roleName() {
        switch (roleSelected) {
            case "ADMINISTRADOR":
                return "Administrador";
            case "NEO":
                return "Dueño";
            case "LISTERO":
                return "Listero";
            case "LISTERO_PRO":
                return "Listero Pro";
            case "PORTERIA":
                return "Portería";
            default:
                return "Sin rol?";
        }
    }

    function onSubmit(data: FormData) {
        setError("");
        if (data.repassword !== "" && data.password !== data.repassword) {
            setError("El password y su verificación deben coincidir.");
            return;
        }
        saveMutation.mutate(data);
    }

    // `isPending` de useQuery sigue en true si la query está deshabilitada
    // (accountId vacío) y nunca corrió, por eso se exige accountId acá también.
    if (accountId && loading) {
        return (
            <div className="flex min-h-screen items-center justify-center text-gray-400 text-2xl">
                <FiLoader className="w-5 h-5 mr-3 animate-spin" /> Cargando cuenta
            </div>
        );
    }

    function handleBack() {
        router.back();
    }

    return (
        <div className="w-full h-screen overflow-y-auto">
            <div className="max-w-3xl mx-auto p-8">

                <div className="w-full flex justify-end md:justify-start mb-8 space-x-3 text-cyan-400">
                    <FaUserEdit size={36} />
                    <h1 className="text-3xl font-bold">
                        {account ? "Editar " : "Nuevo "}
                        {roleName()}
                    </h1>
                </div>

                {error && (
                    <div className="mb-6 rounded-lg border border-red-500 bg-red-500/20 p-4 text-red-300">
                        {error}
                    </div>
                )}

                <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="space-y-6"
                >

                    <div>
                        <label className="block mb-2 text-cyan-300">
                            Nombre
                        </label>
                        <input
                            {...register("name")}
                            className="w-full rounded-lg bg-white/10 border border-cyan-400/20 p-3 text-white"
                        />
                    </div>

                    <div>
                        <label className="block mb-2 text-cyan-300">
                            Email
                        </label>
                        <input
                            type="email"
                            {...register("email")}
                            className="w-full rounded-lg bg-white/10 border border-cyan-400/20 p-3 text-white"
                        />
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">

                        <div>
                            <label className="block mb-2 text-cyan-300">
                                Password
                            </label>
                            <input
                                type="password"
                                {...register("password")}
                                className="w-full rounded-lg bg-white/10 border border-cyan-400/20 p-3 text-white"
                            />
                        </div>

                        <div>
                            <label className="block mb-2 text-cyan-300">
                                Repetir Password
                            </label>
                            <input
                                type="password"
                                {...register("repassword")}
                                className="w-full rounded-lg bg-white/10 border border-cyan-400/20 p-3 text-white"
                            />
                        </div>

                    </div>
                    

                    <div className="grid grid-cols-2 md:grid-cols-2 gap-6">

                        <div>
                            <label className="block mb-2 text-cyan-300">
                                Máx. invitados/evento
                            </label>
                            <input
                                type="number"
                                {...register("maxAttendersByEvent", { valueAsNumber: true })}
                                className="w-full rounded-lg bg-white/10 border border-cyan-400/20 p-3 text-white"
                            />
                        </div>

                        {(roleSelected === "LISTERO" || roleSelected === "LISTERO_PRO") && (
                            <div>
                                <div className="flex space-x-3 items-center">
                                    <input
                                        type="checkbox"
                                        {...register("isPro")}
                                        className="h-7 w-7"
                                    />
                                    <label className="flex">
                                        <div className="">
                                            <p className="text-xl text-cyan-300 ml-2">
                                                PRO
                                            </p>
                                            <p className="text-cyan-800 text-md ml-2">
                                                Puede importar hasta las <b>{isProCheck ? '01:00 am' : '12:30 am'}</b>
                                            </p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex space-x-4">
                        <button
                            onClick={handleBack}
                            className="w-full rounded-lg bg-neutral-500 hover:bg-neutral-400 font-bold py-3 flex justify-center items-center gap-3 transition text-2xl text-white"
                        >
                            &lt;&lt; Volver
                        </button>
                        <button
                            type="submit"
                            disabled={saveMutation.isPending}
                            className="w-full rounded-lg bg-cyan-500 hover:bg-cyan-400 font-bold py-3 flex justify-center items-center gap-3 transition text-2xl text-white"
                        >
                            <FaSave />
                            {saveMutation.isPending ? "Guardando..." : "Guardar"}
                        </button>
                    </div>

                </form>

            </div>
        </div>
    );

}
