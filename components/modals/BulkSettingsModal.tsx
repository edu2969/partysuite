"use client";

import { useEffect, useState } from "react";
import { FiLoader } from "react-icons/fi";
import { LiaTimesSolid } from "react-icons/lia";
import { isValidProImportTime } from "@/lib/eventClose";

export type BulkTarget = "LISTERO" | "LISTERO_PRO" | "BOTH";

export interface BulkSettingsPayload {
  maxAttendersByEvent: number;
  maxImportTime: string;
  appliesTo: BulkTarget;
}

const DEFAULT_MAX_ATTENDERS = "500";
const DEFAULT_MAX_IMPORT_TIME = "00:30";

export default function BulkSettingsModal({
  show,
  isPending,
  onClose,
  onSubmit,
}: {
  show: boolean;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (payload: BulkSettingsPayload) => void;
}) {
  const [maxAttendersByEvent, setMaxAttendersByEvent] = useState(DEFAULT_MAX_ATTENDERS);
  const [maxImportTime, setMaxImportTime] = useState(DEFAULT_MAX_IMPORT_TIME);
  const [appliesToListers, setAppliesToListers] = useState(true);
  const [appliesToPro, setAppliesToPro] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) return;
    setMaxAttendersByEvent(DEFAULT_MAX_ATTENDERS);
    setMaxImportTime(DEFAULT_MAX_IMPORT_TIME);
    setAppliesToListers(true);
    setAppliesToPro(true);
    setError("");
  }, [show]);

  if (!show) return null;

  const handleSubmit = () => {
    const amount = Number(maxAttendersByEvent);

    if (!Number.isInteger(amount) || amount < 1) {
      setError("La máxima cantidad de importación debe ser un entero mayor a 0.");
      return;
    }

    if (!appliesToListers && !appliesToPro) {
      setError("Debe seleccionar al menos un tipo de listero.");
      return;
    }

    if (appliesToPro && !isValidProImportTime(maxImportTime)) {
      setError("La hora máxima debe ser posterior a las 23:30 o anterior a las 05:00.");
      return;
    }

    setError("");

    onSubmit({
      maxAttendersByEvent: amount,
      maxImportTime,
      appliesTo:
        appliesToListers && appliesToPro
          ? "BOTH"
          : appliesToPro
          ? "LISTERO_PRO"
          : "LISTERO",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-cyan-400/20 bg-slate-900 p-8 space-y-6">
        <button
          className="absolute right-4 top-4 cursor-pointer text-gray-400 hover:text-white"
          onClick={onClose}
          disabled={isPending}
          aria-label="Cerrar"
        >
          <LiaTimesSolid className="text-2xl" />
        </button>

        <div>
          <h3 className="text-2xl font-bold text-cyan-400">Ajustes Masivos</h3>
          <p className="mt-1 text-sm text-gray-400">
            Actualiza los límites de importación de los listeros seleccionados.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-cyan-300">
              Máxima cantidad de importación
            </label>
            <input
              type="number"
              min={1}
              value={maxAttendersByEvent}
              onChange={(e) => setMaxAttendersByEvent(e.target.value)}
              disabled={isPending}
              className="w-full rounded-lg border border-cyan-400/20 bg-white/10 p-3 text-white outline-none focus:border-cyan-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-cyan-300">
              Hora máxima de importación
            </label>
            <input
              type="time"
              step={60}
              value={maxImportTime}
              onChange={(e) => setMaxImportTime(e.target.value)}
              disabled={isPending || !appliesToPro}
              className="w-full rounded-lg border border-cyan-400/20 bg-white/10 p-3 text-white outline-none focus:border-cyan-500 disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-gray-400">
              Entre 23:31 y 23:59 del evento, o 00:00 y 04:59 del día siguiente.
              {!appliesToPro && " Solo aplica a LISTERO_PRO."}
            </p>
          </div>

          <div>
            <span className="mb-2 block text-sm text-cyan-300">Aplica a</span>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-3 text-white">
                <input
                  type="checkbox"
                  checked={appliesToListers}
                  onChange={(e) => setAppliesToListers(e.target.checked)}
                  disabled={isPending}
                  className="h-6 w-6"
                />
                LISTERO
              </label>
              <label className="flex items-center gap-3 text-white">
                <input
                  type="checkbox"
                  checked={appliesToPro}
                  onChange={(e) => setAppliesToPro(e.target.checked)}
                  disabled={isPending}
                  className="h-6 w-6"
                />
                LISTERO_PRO
              </label>
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-4">
          <button
            className="rounded-lg bg-neutral-600 px-6 py-3 font-semibold text-white transition hover:bg-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </button>
          <button
            className="flex justify-center rounded-lg bg-cyan-500 px-6 py-3 font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <FiLoader className="mr-3 mt-1 h-5 w-5 animate-spin" /> Aplicando...
              </>
            ) : (
              "Aplicar"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
