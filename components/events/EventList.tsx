"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BiParty } from "react-icons/bi";
import Link from "next/link";
import { FaPlus } from "react-icons/fa6";
import {
  EVENT_TIME_ZONE,
  getEventCountdownStart,
} from "@/lib/eventClose";

interface EventData {
  _id: string;
  name: string;
  businessDate: string;
  startsAt?: string;
  total: number;
  arrives: number;
  listClosedAt: string;
  closeAt: string;
  timeZone?: string;
}

interface SessionUser {
  role?: string;
  isRPAdmin?: boolean;
}

interface EventsListProps {
  user: SessionUser;
}

function formatDate(date: string) {
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  const businessDate = new Date(Date.UTC(year, month - 1, day, 12));

  return new Intl.DateTimeFormat("es-CL", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(businessDate);
}

function formatEventTime(date: string) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: EVENT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(date));
}

const EVENTS_REFRESH_INTERVAL = 10_000;

function EventCountdown({
  businessDate,
  startsAt,
  closedAt,
}: {
  businessDate: string;
  startsAt?: string;
  closedAt: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  const startAt = startsAt
    ? new Date(startsAt).getTime()
    : getEventCountdownStart(businessDate)?.getTime();
  const endAt = new Date(closedAt).getTime();

  useEffect(() => {
    if (
      startAt === undefined ||
      endAt === undefined ||
      !Number.isFinite(startAt) ||
      !Number.isFinite(endAt) ||
      endAt <= startAt
    ) {
      return;
    }

    let timeout: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const tick = () => {
      const timestamp = Date.now();
      setNow(timestamp);

      if (!cancelled && timestamp < endAt) {
        const delay = timestamp < startAt
          ? startAt - timestamp
          : 1_000;
        timeout = setTimeout(tick, Math.min(delay, 2_147_483_647));
      }
    };

    const timestamp = Date.now();
    if (timestamp < endAt) {
      timeout = setTimeout(tick, timestamp < startAt
        ? Math.min(startAt - timestamp, 2_147_483_647)
        : 0);
    }

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [startAt, endAt]);

  if (
    now === null ||
    startAt === undefined ||
    endAt === undefined ||
    !Number.isFinite(startAt) ||
    !Number.isFinite(endAt) ||
    now < startAt ||
    now >= endAt
  ) {
    return null;
  }

  const duration = endAt - startAt;
  const remaining = endAt - now;
  const remainingRatio = Math.max(
    0,
    Math.min((endAt - Math.max(now, startAt)) / duration, 1)
  );
  const elapsedRatio = 1 - remainingRatio;
  const urgency = elapsedRatio >= 0.9 ? "red" : elapsedRatio >= 0.1 ? "amber" : "green";
  const colors = {
    green: { text: "text-emerald-400", fill: "bg-emerald-500" },
    amber: { text: "text-amber-300", fill: "bg-amber-400" },
    red: { text: "text-red-400", fill: "bg-red-500" },
  }[urgency];
  const totalSeconds = Math.ceil(remaining / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const countdown = [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");

  return (
    <div className="absolute top-0 right-6  mt-2 max-w-sm" aria-label="Cuenta regresiva para el cierre de lista">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className={`text-sm font-medium ${colors.text}`}>Cierra en</span>
        <time className={`font-mono text-lg font-semibold tabular-nums ${colors.text}`} role="timer" aria-live="off">
          {countdown}
        </time>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-700"
        role="progressbar"
        aria-label="Tiempo restante hasta el cierre de lista"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.ceil(remainingRatio * 100)}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ${colors.fill}`}
          style={{ width: `${remainingRatio * 100}%` }}
        />
      </div>
    </div>
  );
}

export default function EventsList({
  user,
}: EventsListProps) {
  const router = useRouter();

  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [generatingBI, setGeneratingBI] = useState<string | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);  
  const [canImport, setCanImport] = useState(false);

  const isNeo = user.role === "NEO";
  const isAdmin = isNeo || user.role === "ADMINISTRADOR";
  useEffect(() => {
    loadEvents();

    let timeout: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const refreshEvents = async () => {
      await loadEvents(false);
      if (!cancelled) {
        timeout = setTimeout(refreshEvents, EVENTS_REFRESH_INTERVAL);
      }
    };

    timeout = setTimeout(refreshEvents, EVENTS_REFRESH_INTERVAL);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  const loadEvents = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError("");

      const response = await fetch(
        "/api/events",
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          "No fue posible obtener los eventos"
        );
      }

      const data = await response.json();
      setEvents(data.events || []);
      setCanImport(data.canImport);
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "Error al obtener eventos"
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleEdit = (eventId: string) => {
    router.push(
      `/events/${eventId}`
    );
  };

  const handleImport = (eventId: string) => {
    router.push(
      `/events/import/${eventId}`
    );
  };

  const handleList = (eventId: string) => {
    router.push(
      `/attenders/${eventId}`
    );
  };

  const handleBI = async (eventId: string) => {
    if (generatingBI) return;

    try {
      setGeneratingBI(eventId);

      const response = await fetch(
        `/api/events/${eventId}/bi`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          "No fue posible generar el BI"
        );
      }

      router.push(
        `/eventEdit/${eventId}`
      );
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Error generando BI"
      );
    } finally {
      setGeneratingBI(null);
    }
  };

  const onDeleteConfirm = async (eventId: string) => {
    try {
      setDeleting(eventId);

      const response = await fetch(
        `/api/events/${eventId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          "No fue posible eliminar el evento"
        );
      }

      setEvents((current) =>
        current.filter(
          (event) =>
            event._id !== eventId
        )
      );
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Error eliminando evento"
      );
    } finally {
      setDeleting(null);
    }
  }

  const handleDelete = async (
    eventId: string,
    eventName: string
  ) => {
    if (deleting) return;

    const confirmed = window.confirm(
      `¿Está seguro que desea eliminar el evento "${eventName}"?\n\nTambién se eliminarán sus listas y datos BI.`
    );

    if (!confirmed) return;

    try {
      setDeleting(eventId);

      const response = await fetch(
        `/api/events/${eventId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          "No fue posible eliminar el evento"
        );
      }

      setEvents((current) =>
        current.filter(
          (event) =>
            event._id !== eventId
        )
      );
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Error eliminando evento"
      );
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto flex min-h-100 max-w-6xl items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-cyan-400" />
          Cargando eventos...
        </div>
      </main>
    );
  }

  return (<main className="w-full h-screen overflow-y-auto">
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">

      <div className="flex flex-col items-end space-y-3 mb-8 w-full md:flex-row md:items-center md:justify-between md:space-y-0 md:space-x-3">
        <h1 className="flex gap-3 text-3xl font-bold text-white text-nowrap">
          <span className="text-cyan-400">
            <BiParty />
          </span>
          <span className="text-3xl">Eventos</span> <span className="mt-2 text-lg">(últimos 5)</span>
        </h1>
        {isAdmin && (
          <div className="text-2xl">
            <div className="rounded-md bg-cyan-600 text-white hover:bg-cyan-500">
              <Link className="flex gap-2 px-5 py-2 items-center" href="/events/new"><FaPlus /> Nuevo evento</Link>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      )}

      {events.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-10 text-center">
          <h4 className="text-lg text-gray-400">
            No hay eventos
          </h4>
        </div>
      ) : (
        <div className="space-y-4">

          {events.map((event, index) => (
            <div
              key={event._id}
              className={`relative rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg transition hover:border-slate-700 ${index > 0 ? 'opacity-40 grayscale-75' : 'opacity-100 grayscale-0'}`}
            >

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                <div className="flex flex-col min-w-0">

                  <h2 className="text-3xl font-semibold text-white -mt-2">
                    {event.name}                    
                  </h2>

                  <span className="block text-2xl text-gray-200">
                    {formatDate(event.businessDate)}
                  </span>

                  <span className="text-lg font-normal text-gray-400">
                      Asisten <span className="text-cyan-400">{event.arrives || 0}</span> de {event.total || 0}</span>

                  <p className="text-md font-normal text-gray-400">Cierre de lista: <b>{formatEventTime(event.listClosedAt)}</b></p>
                  {(!canImport && index === 0) &&  <p className="text-orange-400">📢 Ya no se puede importar más</p>}
                  {index === 0 && (
                  <EventCountdown
                    businessDate={event.businessDate}
                    startsAt={event.startsAt}
                    closedAt={event.listClosedAt}
                  />
                  )}

                </div>

                <div className="flex flex-wrap justify-end items-end h-26 gap-2 text-2xl">                  

                  {(isAdmin || isNeo) && <button
                    type="button"
                    onClick={() =>
                      handleList(event._id)
                    }
                    className="rounded-lg bg-blue-600 px-3 py-2 font-medium text-white transition hover:bg-blue-500"
                  >
                    ☷ Lista
                  </button>}

                  {(isAdmin || isNeo) && <button
                    type="button"
                    onClick={() =>
                      handleEdit(event._id)
                    }
                    className="rounded-lg bg-blue-600 px-3 py-2 font-medium text-white transition hover:bg-blue-500"
                  >
                    👀 Ver
                  </button>}

                  {(canImport && index == 0) && <button
                    type="button"
                    onClick={() =>
                      handleImport(event._id)
                    }
                    className="rounded-lg bg-blue-600 px-3 py-2 font-medium text-white transition hover:bg-blue-500"
                  >
                    📥 Importar
                  </button>}                  

                  {isAdmin && new Date(event.closeAt) >= new Date(event.listClosedAt) && (
                    <button
                      type="button"
                      onClick={() =>
                        handleDelete(
                          event._id,
                          event.name
                        )
                      }
                      disabled={
                        deleting ===
                        event._id
                      }
                      className="rounded-lg bg-red-600 px-3 py-2 font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
                    >
                      {deleting === event._id
                        ? "Eliminando..."
                        : "♲ Eliminar"}
                    </button>
                  )}

                  
                </div>                
              </div>              
            </div>
          ))}

        </div>
      )}
    </div>
  </main>
  );
}