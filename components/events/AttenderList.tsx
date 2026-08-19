"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface Event {
  _id: string;
  name: string;
  total: number;
  arrives: number;
}

interface AttenderItem {
  _id: string;
  guestId: string;
  names: string;
  rp: string;
  baneado: boolean;
  checktime?: string;
}

export default function AttenderList({
  eventId,
}: {
  eventId: string;
}) {
  const [evento, setEvento] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [text, setText] = useState("");
  const [invitados, setInvitados] = useState<AttenderItem[]>([]);

  const load = async (filter = "") => {
    if (!eventId) return;
    setSearching(true);

    const res = await fetch(
      `/api/events/${eventId}/attenders?q=${encodeURIComponent(filter)}`
    );

    const json = await res.json();

    setEvento(json.event);
    setInvitados(json.items);

    setLoading(false);
    setSearching(false);
  };

  useEffect(() => {
    load("");
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      load(text);
    }, 200);

    return () => clearTimeout(timer);
  }, [text]);

  const rows = useMemo(() => invitados, [invitados]);

  return (
    <main className="w-full h-screen overflow-y-scroll">
      <div className="mx-auto max-w-5xl p-6">

        <div className="mb-8">

          <h1 className="text-3xl font-bold text-white">
            {evento?.name}
          </h1>

          <p className="mt-1 text-gray-400">
            Asisten {evento?.arrives ?? 0} de {evento?.total ?? 0}
          </p>

        </div>

        <div className="mb-6">

          <label className="mb-2 block text-sm text-gray-300">
            Búsqueda por invitado o RP
          </label>

          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Texto..."
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-500"
          />

          <div className="mt-2 h-5 text-sm text-gray-400">
            {searching && "Buscando..."}
          </div>

        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400">
            Cargando...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-gray-400">
            No existen asistentes para este evento
          </div>
        ) : (
          <div className="space-y-3">

            {rows.map((g) => (
              <div
                key={g.guestId}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-5"
              >
                <div>

                  <h3 className="text-lg font-semibold text-white">
                    {g.names}
                    <span className="ml-2 text-sm font-normal text-cyan-400">
                      ({g.rp})
                    </span>
                  </h3>

                  {g.baneado && (
                    <div className="mt-1 text-sm text-red-500">
                      (Baneado)
                    </div>
                  )}

                  <div className="mt-2 text-sm text-gray-400">
                    {g.checktime
                      ? `Llegada: ${new Date(g.checktime).toLocaleTimeString(
                        "es-CL",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}`
                      : "No ha llegado"}
                  </div>

                </div>

                <Link
                  href={`/guests/${g.guestId}`}
                  className="rounded-lg bg-cyan-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-cyan-500"
                >
                  Ver
                </Link>

              </div>
            ))}

          </div>
        )}
      </div>
    </main>
  );
}