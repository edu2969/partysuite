"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FaSave, FaUserEdit } from "react-icons/fa";
import { FiLoader } from "react-icons/fi";
import { isValidProImportTime } from "@/lib/eventClose";

interface Account {
    _id?: string;
    name: string;
    email: string;
    role: "ADMINISTRADOR" | "PORTERIA" | "LISTERO" | "NEO" | "LISTERO_PRO" | "ELIMINADO",
    maxAttendersByEvent: number;
    maxImportTime?: string;
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
    maxImportTime: string;
}

async function fetchAccount(accountId: string): Promise<Account> {
    const resp = await fetch(`/api/accounts/${accountId}`, {
        cache: "no-store",
    });
    if (!resp.ok) throw new Error("No fue posible obtener la cuenta.");
    const response = await resp.json();
    return response.account;
}

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
        const response = await fetch("/api/accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: data.name,
                email: data.email,
                role: data.isPro ? "LISTERO_PRO" : "LISTERO",
                password: data.password,
                maxAttendersByEvent: data.maxAttendersByEvent,
                ...(data.isPro ? { maxImportTime: data.maxImportTime } : {}),
            }),
        });
        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.message || "No fue posible guardar la cuenta.");
        }
        return;
    }

    const payload: {
        _id: string | null;
        name: string;
        email: string;
        role: string;
        password?: string;
        maxAttendersByEvent: number;
        maxImportTime?: string;
    } = {
        _id: accountId,
        name: data.name,
        email: data.email,
        role: data.isPro ? "LISTERO_PRO" : "LISTERO",
        maxAttendersByEvent: data.maxAttendersByEvent,
        ...(data.isPro ? { maxImportTime: data.maxImportTime } : {}),
    };
    if (data.repassword) {
        payload.password = data.password;
    }

    const response = await fetch(`/api/accounts/${account._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "No fue posible guardar la cuenta.");
    }
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
            maxAttendersByEvent: 500,
            maxImportTime: "00:30",
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
            maxAttendersByEvent: account.maxAttendersByEvent,
            maxImportTime: account.maxImportTime || "00:30",
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
        onError: (mutationError) => {
            setError(mutationError instanceof Error
                ? mutationError.message
                : "No fue posible guardar la cuenta.");
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
        if (data.isPro && !isValidProImportTime(data.maxImportTime)) {
            setError("La hora máxima debe ser posterior a las 23:30 o anterior a las 05:00.");
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
                                Password {account ? "nuevo" : "inicial"}
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
                    

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-8">

                        <div className="md:col-span-2">
                            <label className="block mb-2 text-cyan-300">
                                Máx. invitados/evento
                            </label>
                            <input
                                type="number"
                                min={1}
                                disabled={!isProCheck}
                                {...register("maxAttendersByEvent", {
                                    valueAsNumber: true,
                                    min: 1,
                                })}
                                className="w-full rounded-lg bg-white/10 border border-cyan-400/20 p-3 text-white disabled:opacity-50"
                            />
                        </div>

                        {(roleSelected === "LISTERO" || roleSelected === "LISTERO_PRO") && (
                            <div className="md:col-span-3 flex items-center">
                                <div className="flex space-x-3 items-center">
                                    <input
                                        type="checkbox"
                                        {...register("isPro")}
                                        className="h-7 w-7"
                                    />
                                    <label className="flex">
                                        <div className="">
                                            <p className={`text-xl ${isProCheck ? 'text-cyan-300' : 'text-neutral-400' } ml-2`}>
                                                {isProCheck ? 'es PRO' : 'no es PRO'}
                                            </p>
                                            <p className={`${isProCheck ? 'text-cyan-800' : 'text-neutral-500'} text-md ml-2`}>
                                                <b>{isProCheck ? 'Límite de importación personalizado' : 'Cierre según el evento'}</b>
                                            </p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        )}

                        {isProCheck && (
                            <div className="md:col-span-3">
                                <label className="mb-2 block text-cyan-300">
                                    Hora máxima de importación
                                </label>
                                <input
                                    type="time"
                                    step={60}
                                    disabled={saveMutation.isPending}
                                    {...register("maxImportTime")}
                                    className="w-full rounded-lg bg-white/10 border border-cyan-400/20 p-3 text-white"
                                />
                                <p className="mt-1 text-xs text-neutral-400">
                                    Entre 23:31 y 23:59 del evento, o 00:00 y 04:59 del día siguiente.
                                </p>
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
