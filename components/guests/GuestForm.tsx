"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Guest {
  _id: string;
  names: string;
  rut: string;
  baneado?: boolean;
  gender?: "F" | "M" | null;
  observacion?: string;
  global?: boolean;
}

interface GuestFormProps {
  guestId: string;
  user: {
    role?: string;
    isRPAdmin?: boolean;
  };
}

export default function GuestForm({
  guestId,
  user,
}: GuestFormProps) {
  const router = useRouter();

  const [guest, setGuest] =
    useState<Guest | null>(null);

  const [names, setNames] = useState("");
  const [baneado, setBaneado] =
    useState(false);
  const [gender, setGender] =
    useState<"F" | "M" | null>(null);
  const [observacion, setObservacion] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const canEdit =
    user.isRPAdmin === true ||
    user.role === "ADMIN";

  useEffect(() => {
    loadGuest();
  }, [guestId]);

  async function loadGuest() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/guests/${guestId}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "No fue posible obtener el invitado"
        );
      }

      const g: Guest = data.guest;

      setGuest(g);
      setNames(g.names || "");
      setBaneado(!!g.baneado);
      setGender(g.gender || null);
      setObservacion(
        g.observacion || ""
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Error obteniendo invitado"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!canEdit || saving) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        `/api/guests/${guestId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            names,
            gender,
            baneado,
            observacion,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "No fue posible guardar"
        );
      }

      router.back();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Error guardando invitado"
      );
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    if (guest?.global) {
      router.push("/clientes");
      return;
    }

    router.back();
  }

  if (loading) {
    return (
      <main className="flex min-h-100 items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-cyan-400" />
          Cargando invitado...
        </div>
      </main>
    );
  }

  if (!guest) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          {error ||
            "Invitado no encontrado"}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">

      <div className="mb-6">
        <h3 className="flex items-center gap-3 text-2xl font-semibold text-white">
          <span className="text-cyan-400">
            ◉
          </span>

          Info Básica
        </h3>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="space-y-6"
      >

        <div>
          <label
            htmlFor="guest-names"
            className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400"
          >
            Nombres
          </label>

          <input
            id="guest-names"
            type="text"
            value={names}
            onChange={(e) =>
              setNames(e.target.value)
            }
            disabled={!canEdit}
            placeholder="Nombres"
            className="block w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-white outline-none transition placeholder:text-gray-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div>
          <label
            htmlFor="guest-rut"
            className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400"
          >
            Rut
          </label>

          <input
            id="guest-rut"
            type="text"
            value={guest.rut}
            disabled
            className="block w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-gray-400"
          />
        </div>

        <div>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              id="checkbox-baneado"
              type="checkbox"
              checked={baneado}
              onChange={(e) =>
                setBaneado(
                  e.target.checked
                )
              }
              disabled={!canEdit}
              className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-red-600 focus:ring-red-500 disabled:opacity-50"
            />

            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
              ¿Baneado?
            </span>
          </label>
        </div>

        <div>
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
            Género
          </span>

          <div className="flex gap-2">

            <button
              type="button"
              disabled={!canEdit}
              onClick={() =>
                setGender("F")
              }
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                gender === "F"
                  ? "bg-cyan-500 text-white"
                  : "bg-slate-800 text-gray-300 hover:bg-slate-700"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              Fem
            </button>

            <button
              type="button"
              disabled={!canEdit}
              onClick={() =>
                setGender(null)
              }
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                gender === null
                  ? "bg-cyan-500 text-white"
                  : "bg-slate-800 text-gray-300 hover:bg-slate-700"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              S/I
            </button>

            <button
              type="button"
              disabled={!canEdit}
              onClick={() =>
                setGender("M")
              }
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                gender === "M"
                  ? "bg-cyan-500 text-white"
                  : "bg-slate-800 text-gray-300 hover:bg-slate-700"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              Mas
            </button>

          </div>
        </div>

        <div>
          <label
            htmlFor="textarea-observacion"
            className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400"
          >
            Observación
          </label>

          <textarea
            id="textarea-observacion"
            rows={4}
            value={observacion}
            onChange={(e) =>
              setObservacion(
                e.target.value
              )
            }
            disabled={!canEdit}
            className="block w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div className="grid grid-cols-12 gap-3 pt-4">

          <div className="col-span-4">
            <button
              type="button"
              onClick={handleBack}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-600"
            >
              ← Volver
            </button>
          </div>

          <div className="col-span-8">
            <button
              type="submit"
              disabled={!canEdit || saving}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Guardando..."
                : "💾 Guardar"}
            </button>
          </div>

        </div>

      </form>
    </main>
  );
}