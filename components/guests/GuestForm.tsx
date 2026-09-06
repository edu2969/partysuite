"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Loader from "../prefabs/Loader";
import { TbUserEdit } from "react-icons/tb";

interface Guest {
  _id: string;
  names: string;
  rut: string;
  banned?: boolean;
  observacion?: string;
  vip?: boolean;
  royalties: string;
  global?: boolean;  
}

interface GuestFormProps {
  guestId: string;
  role: string;
}

export default function GuestForm({
  guestId,
  role
}: GuestFormProps) {
  const router = useRouter();
  const [guest, setGuest] = useState<Guest | null>(null);
  const [names, setNames] = useState("");
  const [banned, setbanned] = useState(false);
  const [vip, setVip] = useState(false);
  const [observacion, setObservacion] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [royalties, setRoyalties] = useState("");
  const [error, setError] = useState("");

  const canEdit = role === "ADMINISTRADOR" || role === "NEO";

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
      setbanned(!!g.banned);
      setObservacion(
        g.observacion || ""
      );
      setRoyalties(
        g.royalties || ""
      )
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
            banned,
            observacion,
            vip,
            royalties
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
    return <Loader text="Cargando invitado..."/>
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
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8 text-2xl">

      <div className="flex mb-8 space-x-3 text-cyan-400">
        <TbUserEdit size={36} />
        <h1 className="text-3xl font-bold">
          Info. Básica Invitado
        </h1>
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
              id="checkbox-vip"
              type="checkbox"
              checked={vip}
              onChange={(e) =>
                setVip(
                  e.target.checked
                )
              }
              disabled={!canEdit}
              className="h-6 w-6 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500 disabled:opacity-50"
            />

            <span className="text-xl font-medium uppercase tracking-wide text-gray-400">
              VIP
            </span>
          </label>
        </div>

        {vip && (<div>
          <label
            htmlFor="textarea-observacion"
            className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400"
          >
            Regalías
          </label>

          <textarea
            id="textarea-royalties"
            rows={4}
            value={royalties}
            onChange={(e) =>
              setRoyalties(
                e.target.value
              )
            }
            className="block w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>)}

        <hr/>

        <div>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              id="checkbox-banned"
              type="checkbox"
              checked={banned}
              onChange={(e) =>
                setbanned(
                  e.target.checked
                )
              }
              disabled={!canEdit}
              className="h-6 w-6 rounded border-gray-600 bg-gray-700 text-red-600 focus:ring-red-500 disabled:opacity-50"
            />

            <span className="text-xl font-medium uppercase tracking-wide text-gray-400">
              ¿banned?
            </span>
          </label>
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
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-700 px-4 py-2.5 font-medium text-white transition hover:bg-slate-600"
            >
              ← Volver
            </button>
          </div>

          <div className="col-span-8">
            <button
              type="submit"
              disabled={!canEdit || saving}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
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