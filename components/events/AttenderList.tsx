"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TbUserEdit } from "react-icons/tb";
import Loader from "../prefabs/Loader";

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
  user: string;
  eventName?: string;
  banned: boolean;
  arrives: number;
  inscriptions: number;
  vip: boolean;
  royalties?: string;
  checktime?: string;
}

interface AttendersResponse {
  event?: Event | null;
  items: AttenderItem[];
  page: number;
  totalPages: number;
  hasMore: boolean;
}

const PAGE_SIZE = 10;

export default function AttenderList({
  eventId,
}: {
  eventId?: string;
}) {
  const [evento, setEvento] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true); // carga inicial (página 1)
  const [searching, setSearching] = useState(false); // debounce de búsqueda
  const [loadingMore, setLoadingMore] = useState(false); // scroll -> página siguiente
  const [text, setText] = useState("");
  const [invitados, setInvitados] = useState<AttenderItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const router = useRouter();

  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);

  // Con eventId: /api/events/{id}/attenders (un evento puntual).
  // Sin eventId: /api/attenders (todos los eventos). ANTES esto tenía un
  // `if (!eventId) return null` que directamente jamás pedía nada cuando
  // no había eventId — por eso, combinado con los useEffect de abajo,
  // "loading" se quedaba pegado en true para siempre en el modo "todos".
  const fetchPage = useCallback(
    async (pageNum: number, filter: string): Promise<AttendersResponse | null> => {
      const params = new URLSearchParams({
        q: filter,
        page: String(pageNum),
        pageSize: String(PAGE_SIZE),
      });

      const url = eventId
        ? `/api/events/${eventId}/attenders?${params.toString()}`
        : `/api/attenders?${params.toString()}`;

      const res = await fetch(url);
      if (!res.ok) return null;

      return res.json();
    },
    [eventId]
  );

  // Carga inicial y cada cambio de búsqueda: reemplaza la lista y vuelve a
  // página 1.
  const loadFirstPage = useCallback(
    async (filter: string) => {
      const json = await fetchPage(1, filter);
      if (!json) return;

      setEvento(json.event ?? null);
      setInvitados(json.items);
      setPage(1);
      setHasMore(json.hasMore);
    },
    [fetchPage]
  );

  // Scroll al fondo: pide la próxima página y la AGREGA al final (no
  // reemplaza), a diferencia de loadFirstPage.
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      const nextPage = page + 1;
      const json = await fetchPage(nextPage, text);

      if (json) {
        setInvitados((prev) => [...prev, ...json.items]);
        setPage(nextPage);
        setHasMore(json.hasMore);
      }
    } finally {
      // finally, no al final del try: si fetchPage explota (error de red),
      // esto igual se libera y no queda "loadMore" bloqueado para siempre.
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [fetchPage, hasMore, page, text]);

  // Carga inicial. Ya NO corta si falta eventId — ese es justamente el
  // modo "todos los invitados".
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        await loadFirstPage("");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Búsqueda con debounce: reinicia a página 1 y reemplaza la lista.
  useEffect(() => {
    setSearching(true);

    const timer = setTimeout(async () => {
      try {
        await loadFirstPage(text);
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, eventId]);

  // IntersectionObserver sobre un sentinel al final de la lista, con
  // `root` apuntando al <main> scrolleable (no al viewport).
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = mainRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" } // sin `root`: usa el viewport
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const rows = useMemo(() => invitados, [invitados]);

  const handleBack = () => {
    router.back();
  };

  const porcentajeAsistencia = (arrives: number, inscriptions: number) => {
    if (inscriptions === 0) return "";
    const porcentaje = (arrives / inscriptions) * 100;
    return `(${porcentaje.toFixed(1)}%)`;
  }

  const colorarrives = (arrives: number, inscriptions: number) => {
    if (inscriptions === 0) return "text-gray-400";
    const porcentaje = (arrives / inscriptions) * 100;
    if (porcentaje >= 75) return "text-green-400";
    if (porcentaje >= 50) return "text-yellow-400";
    return "text-red-400";
  }
  
  const fondoVIP = (isVIP: boolean) => {
    if (!isVIP) return "bg-slate-900";
    return "bg-linear-to-r from-violet-600/50 to-indigo-600/50";
  }

  return (
    <main ref={mainRef} className="w-full h-screen overflow-y-scroll">
      <div className="mx-auto max-w-5xl p-6 text-xl">

        <div className="flex flex-col items-end gap-4 md:flex-row md:items-start md:justify-between md:gap-0">
          <div className="mb-8">

            <h1 className="text-3xl font-bold text-white text-nowrap">
              {evento ? evento.name : eventId ? 'Invitados' : 'Todos los invitados'}
            </h1>

            {evento && <p className="mt-1 text-gray-400 text-nowrap">
              Asisten {evento?.arrives ?? 0} de {evento?.total ?? 0}
            </p>}

          </div>
          <div className="self-end md:self-auto md:w-auto">
            <button
              className="rounded-lg bg-neutral-600 px-6 py-3 font-semibold text-white transition hover:bg-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleBack}
            >
              &lt;&lt; VOLVER
            </button>
          </div>
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
          <Loader text="Cargando..." />
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-gray-400">
            {text
              ? 'No hay coincidencias'
              : eventId
                ? 'No existen asistentes para este evento'
                : 'No existen asistentes registrados'}
          </div>
        ) : (
          <>
            <div className="space-y-3">

              {rows.map((g) => (
                <div
                  key={g._id}
                  className={`flex items-center justify-between rounded-xl border border-slate-800 p-5 ${fondoVIP(g.vip)}`}
                >
                  <div>

                    <h3 className="text-xl font-semibold text-white">
                      {g.names}
                      <span className="ml-2 text-sm font-normal text-cyan-400">
                        {g.user}
                      </span>
                    </h3>
                    <p className={`text-sm ${colorarrives(g.arrives, g.inscriptions)}`}>
                      {g.arrives} arrives / {g.inscriptions} inscriptions {porcentajeAsistencia(g.arrives, g.inscriptions)}
                    </p>

                    {!eventId && g.eventName && (
                      <div className="mt-1 text-xs text-gray-500">
                        Evento: {g.eventName}
                      </div>
                    )}

                    {g.banned && (
                      <div className="mt-1 text-sm text-red-500">
                        (banned)
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
                    className="rounded-lg bg-cyan-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 text-center"
                  >
                    <TbUserEdit size={28} className="mx-auto" />
                    Editar
                  </Link>

                </div>
              ))}

            </div>

            <div ref={sentinelRef} className="h-px" />

            {loadingMore && (
              <div className="py-6 text-center text-sm text-gray-400">
                Cargando más...
              </div>
            )}

            {!hasMore && !loadingMore && (
              <div className="py-6 text-center text-sm text-gray-600">
                No hay más resultados
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
