// components/form/provider/AutoSaveProvider.tsx
"use client";

import { createContext, useContext, useCallback, useRef, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAutoSaveEngine, type AutoSavePayload } from "../hooks/useAutoSaveEngine";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/** Error de concurrencia optimista: el servidor devolvió 409 (versión obsoleta). */
class AutoSaveConflictError extends Error {
    serverVersion?: string;
    constructor(serverVersion?: string) {
        super("Conflicto de autoguardado");
        this.name = "AutoSaveConflictError";
        this.serverVersion = serverVersion;
    }
}

type AutoSaveContextType = {
    /** Encola un cambio; se envía con debounce por el motor único. */
    saveField: (field: string, value: any) => void;
    /** Envía inmediatamente todo lo pendiente (devuelve la promesa del envío). */
    flush: () => Promise<void> | void;
    trabajoId?: string;
    isSaving: boolean;
    saveStatus: SaveStatus;
};

const AutoSaveContext = createContext<AutoSaveContextType | null>(null);

export function AutoSaveProvider({
    children,
    trabajoId,
}: {
    children: React.ReactNode;
    trabajoId?: string;
}) {
    // Estado reactivo del indicador de guardado.
    const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
    const savedResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);

    // Concurrencia optimista: versión (updated_at) sobre la que se basa la
    // edición actual, y throttle del aviso de conflicto.
    const lastKnownUpdatedAtRef = useRef<string | null>(null);
    const lastConflictToastRef = useRef<number>(0);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (savedResetRef.current) clearTimeout(savedResetRef.current);
        };
    }, []);

    const setStatusSafe = useCallback((next: SaveStatus) => {
        if (mountedRef.current) setSaveStatus(next);
    }, []);

    const scheduleIdle = useCallback(() => {
        if (savedResetRef.current) clearTimeout(savedResetRef.current);
        savedResetRef.current = setTimeout(() => {
            setStatusSafe("idle");
            savedResetRef.current = null;
        }, 2000);
    }, [setStatusSafe]);

    // La única función que habla con la red. El motor la invoca; lanza en error
    // para que el motor haga rollback y reintente.
    const saveFn = useCallback(
        async ({ changes }: AutoSavePayload) => {
            if (!trabajoId) return;
            if (!changes || Object.keys(changes).length === 0) return;

            const response = await fetch("/api/trabajos/autoguardado", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: trabajoId,
                    changes,
                    // Versión sobre la que se basa esta edición (concurrencia optimista).
                    timestamp: lastKnownUpdatedAtRef.current,
                }),
            });

            // Conflicto: el trabajo fue modificado en otra sesión/pestaña.
            if (response.status === 409) {
                const body = await response.json().catch(() => null);
                const serverVersion: string | undefined = body?.serverVersion;
                // Rebase: adoptamos la versión del servidor de modo que el
                // reintento aplique las ediciones locales sobre la última versión.
                if (serverVersion) lastKnownUpdatedAtRef.current = serverVersion;
                throw new AutoSaveConflictError(serverVersion);
            }

            if (!response.ok) {
                throw new Error(`Error en autoguardado: ${response.status}`);
            }

            // Capturar la nueva versión del servidor para basar el próximo guardado.
            const body = await response.json().catch(() => null);
            const nextVersion: string | undefined =
                body?.data?.updated_at ?? body?.timestamp;
            if (nextVersion) lastKnownUpdatedAtRef.current = nextVersion;
        },
        [trabajoId]
    );

    // Motor único de autoguardado: una sola cola + un solo canal de red.
    const { setField, flush: engineFlush } = useAutoSaveEngine(saveFn, {
        debounceMs: 500,
        onSaving: () => setStatusSafe("saving"),
        onSaved: () => {
            setStatusSafe("saved");
            scheduleIdle();
        },
        onError: (error, willRetry) => {
            console.error("Error en autoguardado:", error);

            if (error instanceof AutoSaveConflictError) {
                if (willRetry) {
                    // Se reintenta con la versión más reciente (rebase). Aviso suave.
                    const now = Date.now();
                    if (now - lastConflictToastRef.current > 8000) {
                        lastConflictToastRef.current = now;
                        toast.info("El caso cambió en otra sesión; sincronizando con la última versión…");
                    }
                } else {
                    setStatusSafe("error");
                    toast.error("No se pudo resolver un conflicto de edición. Recarga la página.");
                }
                return;
            }

            if (!willRetry) {
                setStatusSafe("error");
                toast.error("No se pudieron guardar los cambios. Revisa tu conexión.");
            }
        },
    });

    const saveField = useCallback(
        (field: string, value: any) => {
            if (!trabajoId) {
                console.warn(`AutoSave: No se puede guardar "${field}" porque no hay trabajoId`);
                return;
            }
            setField(field, value);
        },
        [trabajoId, setField]
    );

    const flush = useCallback((): Promise<void> | void => {
        if (!trabajoId) return;
        return engineFlush();
    }, [trabajoId, engineFlush]);

    return (
        <AutoSaveContext.Provider value={{
            saveField,
            flush,
            trabajoId,
            isSaving: saveStatus === "saving",
            saveStatus,
        }}>
            {children}
        </AutoSaveContext.Provider>
    );
}

export function useAutoSaveContext() {
    const ctx = useContext(AutoSaveContext);

    if (!ctx) {
        throw new Error("useAutoSaveContext must be used inside AutoSaveProvider");
    }

    return ctx;
}

/**
 * Fuerza un guardado inmediato de los cambios pendientes cada vez que cambia
 * `step`, para no perder ediciones al navegar entre pasos del wizard (Siguiente,
 * Anterior o colapsar). Debe renderizarse dentro de <AutoSaveProvider>.
 */
export function FlushOnStepChange({ step }: { step: number }) {
    const { flush } = useAutoSaveContext();
    const isFirst = useRef(true);

    useEffect(() => {
        // Saltar el montaje inicial: solo flush ante cambios reales de paso.
        if (isFirst.current) {
            isFirst.current = false;
            return;
        }
        void flush();
    }, [step, flush]);

    return null;
}

/**
 * Indicador global de estado de autoguardado.
 * Debe renderizarse dentro de <AutoSaveProvider>.
 */
export function SaveStatusIndicator({ className }: { className?: string }) {
    const { saveStatus } = useAutoSaveContext();

    if (saveStatus === "idle") return null;

    const map = {
        saving: { text: "Guardando…", cls: "text-gray-500", dot: "bg-gray-400 animate-pulse" },
        saved: { text: "Guardado", cls: "text-green-600", dot: "bg-green-500" },
        error: { text: "Error al guardar", cls: "text-red-600", dot: "bg-red-500" },
    } as const;

    const s = map[saveStatus];

    return (
        <div
            role="status"
            aria-live="polite"
            className={`flex items-center gap-2 text-sm font-medium transition-opacity ${s.cls} ${className ?? ""}`}
        >
            <span className={`inline-block w-2 h-2 rounded-full ${s.dot}`} />
            {s.text}
        </div>
    );
}
