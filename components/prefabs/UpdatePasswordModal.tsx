"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import {
    FiAlertCircle,
    FiCheck,
    FiEye,
    FiEyeOff,
    FiLock,
    FiLogOut,
} from "react-icons/fi";

export default function ChangeInitialPasswordModal() {
    const [required, setRequired] = useState(false);
    const [checking, setChecking] = useState(true);

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] =
        useState("");

    const [showPassword, setShowPassword] =
        useState(false);

    const [showConfirmPassword, setShowConfirmPassword] =
        useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const checkPasswordStatus = async () => {
            try {
                const response = await fetch(
                    "/api/auth/password-status",
                    {
                        method: "GET",
                        cache: "no-store",
                    }
                );

                if (!response.ok) {
                    setRequired(false);
                    return;
                }

                const data = await response.json();

                setRequired(data.required === true);
            } catch (error) {
                console.error(
                    "Password status:",
                    error
                );

                setRequired(false);
            } finally {
                setChecking(false);
            }
        };

        checkPasswordStatus();
    }, []);

    if (checking || !required) {
        return null;
    }

    const passwordValid =
        password.length >= 8;

    const passwordsMatch =
        password.length > 0 &&
        password === confirmPassword;

    const canSubmit =
        passwordValid &&
        passwordsMatch &&
        !loading;

    const handleSubmit = async (
        event: React.FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        setError("");

        if (!passwordValid) {
            setError(
                "La contraseña debe tener al menos 8 caracteres."
            );
            return;
        }

        if (!passwordsMatch) {
            setError(
                "Las contraseñas no coinciden."
            );
            return;
        }

        try {
            setLoading(true);

            const response = await fetch(
                "/api/auth/change-password",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        password,
                    }),
                }
            );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.error ||
                        "No fue posible cambiar la contraseña."
                );
            }

            setSuccess(true);

            setTimeout(async () => {
                await signOut({
                    callbackUrl: "/login",
                });
            }, 1200);
        } catch (error) {
            console.error(
                "Change initial password:",
                error
            );

            setError(
                error instanceof Error
                    ? error.message
                    : "Ocurrió un error al cambiar la contraseña."
            );

            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
        >
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center gap-4 border-b border-gray-200 px-6 py-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                        <FiLock size={24} />
                    </div>

                    <div>
                        <h2
                            id="change-password-title"
                            className="text-xl font-semibold text-gray-900"
                        >
                            Cambiar contraseña
                        </h2>

                        <p className="mt-1 text-sm text-gray-500">
                            Debes cambiar tu contraseña
                            inicial antes de continuar.
                        </p>
                    </div>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="space-y-5 px-6 py-6"
                >
                    {!success ? (
                        <>
                            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                                Por seguridad, establece
                                una contraseña personal
                                antes de continuar.
                            </div>

                            <div>
                                <label
                                    htmlFor="new-password"
                                    className="mb-2 block text-sm font-medium text-gray-700"
                                >
                                    Nueva contraseña
                                </label>

                                <div className="relative">
                                    <input
                                        id="new-password"
                                        type={
                                            showPassword
                                                ? "text"
                                                : "password"
                                        }
                                        value={password}
                                        onChange={(event) =>
                                            setPassword(
                                                event.target
                                                    .value
                                            )
                                        }
                                        disabled={loading}
                                        autoComplete="new-password"
                                        className="text-black w-full rounded-lg border border-gray-300 px-4 py-3 pr-12 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                                        placeholder="Mínimo 8 caracteres"
                                    />

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPassword(
                                                (value) =>
                                                    !value
                                            )
                                        }
                                        disabled={loading}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                        aria-label={
                                            showPassword
                                                ? "Ocultar contraseña"
                                                : "Mostrar contraseña"
                                        }
                                    >
                                        {showPassword ? (
                                            <FiEyeOff
                                                size={20}
                                            />
                                        ) : (
                                            <FiEye
                                                size={20}
                                            />
                                        )}
                                    </button>
                                </div>

                                <p className="mt-1 text-xs text-gray-500">
                                    Debe contener al menos
                                    8 caracteres.
                                </p>
                            </div>

                            <div>
                                <label
                                    htmlFor="confirm-password"
                                    className="mb-2 block text-sm font-medium text-gray-700"
                                >
                                    Confirmar contraseña
                                </label>

                                <div className="relative">
                                    <input
                                        id="confirm-password"
                                        type={
                                            showConfirmPassword
                                                ? "text"
                                                : "password"
                                        }
                                        value={
                                            confirmPassword
                                        }
                                        onChange={(event) =>
                                            setConfirmPassword(
                                                event.target
                                                    .value
                                            )
                                        }
                                        disabled={loading}
                                        autoComplete="new-password"
                                        className="text-black w-full rounded-lg border border-gray-300 px-4 py-3 pr-12 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                                        placeholder="Repite la contraseña"
                                    />

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowConfirmPassword(
                                                (value) =>
                                                    !value
                                            )
                                        }
                                        disabled={loading}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                        aria-label={
                                            showConfirmPassword
                                                ? "Ocultar contraseña"
                                                : "Mostrar contraseña"
                                        }
                                    >
                                        {showConfirmPassword ? (
                                            <FiEyeOff
                                                size={20}
                                            />
                                        ) : (
                                            <FiEye
                                                size={20}
                                            />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                                    <FiAlertCircle
                                        className="mt-0.5 shrink-0"
                                        size={18}
                                    />

                                    <span>{error}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={!canSubmit}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {loading ? (
                                    <>
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                        Cambiando contraseña...
                                    </>
                                ) : (
                                    <>
                                        <FiLock size={18} />
                                        Cambiar contraseña
                                    </>
                                )}
                            </button>
                        </>
                    ) : (
                        <div className="py-4 text-center">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                                <FiCheck size={32} />
                            </div>

                            <h3 className="mt-4 text-lg font-semibold text-gray-900">
                                Contraseña actualizada
                            </h3>

                            <p className="mt-2 text-sm text-gray-500">
                                Tu contraseña fue cambiada
                                correctamente.
                            </p>

                            <div className="mt-5 flex items-center justify-center gap-2 text-sm text-gray-600">
                                <FiLogOut size={16} />
                                Cerrando sesión...
                            </div>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}