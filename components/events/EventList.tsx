"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BiParty } from "react-icons/bi";
import Link from "next/link";
import { FaPlus } from "react-icons/fa6";
import { getCurrentBusinessDate } from "@/lib/businessTime";
import { EVENT_TIME_ZONE } from "@/lib/eventClose";

interface EventData {
  _id: string;
  name: string;
  businessDate: string;
  startsAt?: string;
  total: number;
  arrives: number;
  listClosedAt: string;
  closeAt: string;
  canImport: boolean;
  importDeadline: string | null;
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
  startsAt,
  deadlineAt,
}: {
  startsAt?: string;
  deadlineAt: string | null;
}) {
  const [now, setNow] = useState<number | null>(null);
  const startAt = startsAt ? new Date(startsAt).getTime() : Number.NaN;
  const endAt = deadlineAt ? new Date(deadlineAt).getTime() : Number.NaN;

  useEffect(() => {
    if (!Number.isFinite(endAt) || endAt <= Date.now()) return;

    let timeout: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const tick = () => {
      const timestamp = Date.now();
      setNow(timestamp);

      if (!cancelled && timestamp < endAt) {
        timeout = setTimeout(
          tick,
          Math.min(1_000, endAt - timestamp)
        );
      }
    };

    tick();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [endAt]);

  if (
    now === null ||
    !Number.isFinite(endAt) ||
    now >= endAt
  ) {
    return null;
  }

  const remaining = endAt - now;
  const duration = endAt - startAt;
  const remainingRatio = duration > 0
    ? Math.max(0, Math.min(
        (endAt - Math.max(now, startAt)) / duration,
        1
      ))
    : null;
  const elapsedRatio = remainingRatio === null ? 0 : 1 - remainingRatio;
  const urgency =
    elapsedRatio >= 0.9 ? "red" : elapsedRatio >= 0.1 ? "amber" : "green";
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
    <div className="mt-2 max-w-sm" aria-label="Cuenta regresiva para el cierre de importación">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className={`text-sm font-medium ${colors.text}`}>Importación cierra en</span>
        <time className={`font-mono text-lg font-semibold tabular-nums ${colors.text}`} role="timer" aria-live="off">
          {countdown}
        </time>
      </div>
      {remainingRatio !== null && (
        <div
          className="h-2 overflow-hidden rounded-full bg-slate-700"
          role="progressbar"
          aria-label="Tiempo restante para importar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.ceil(remainingRatio * 100)}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-1000 ${colors.fill}`}
            style={{ width: `${remainingRatio * 100}%` }}
          />
        </div>
      )}
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
  const [selectedDeleteEvent, setSelectedDeleteEvent] = useState<EventData | null>(null);
  const [deleteError, setDeleteError] = useState("");
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
      setCanImport(data.events?.[0]?.canImport ?? false);
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

  const handleDelete = (event: EventData) => {
    if (!isAdmin || deleting) return;
    setDeleteError("");
    setSelectedDeleteEvent(event);
  };

  const confirmDelete = async () => {
    if (!isAdmin || !selectedDeleteEvent || deleting) return;

    const eventId = selectedDeleteEvent._id;
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
          data.error ||
          "No fue posible eliminar el evento"
        );
      }

      const remainingEvents = events.filter((event) => event._id !== eventId);
      setEvents(remainingEvents);
      setCanImport(remainingEvents[0]?.canImport ?? false);
      setSelectedDeleteEvent(null);
    } catch (error) {
      console.error(error);
      setDeleteError(
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

          {events.map((event, index) => {
            const isPastEvent =
              getCurrentBusinessDate(event.timeZone ?? EVENT_TIME_ZONE) >
              event.businessDate.slice(0, 10);

            return (
              <div
                key={event._id}
                className={`relative rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg transition hover:border-slate-700 ${index > 0 || isPastEvent ? "opacity-40 grayscale-75" : "opacity-100 grayscale-0"}`}
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
                    startsAt={event.startsAt}
                    deadlineAt={event.importDeadline}
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

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDelete(event)}
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
            );
          })}

        </div>
      )}
    </div>

    {selectedDeleteEvent && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-event-title"
        aria-describedby="delete-event-description"
      >
        <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
          <h2 id="delete-event-title" className="text-xl font-bold text-white">
            Confirmar eliminación
          </h2>
          <p id="delete-event-description" className="mt-4 text-gray-300">
            ¿Está seguro que desea eliminar el evento{" "}
            <strong className="text-white">{selectedDeleteEvent.name}</strong>?
            El evento se marcará como eliminado; sus listas y datos BI se
            conservarán.
          </p>

          {deleteError && (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300" role="alert">
              {deleteError}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedDeleteEvent(null);
                setDeleteError("");
              }}
              disabled={deleting !== null}
              className="rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting !== null}
              className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-500 disabled:cursor-wait disabled:opacity-50"
            >
              {deleting === selectedDeleteEvent._id
                ? "Eliminando..."
                : "Eliminar evento"}
            </button>
          </div>
        </div>
      </div>
    )}
  </main>
  );
}