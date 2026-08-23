"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BiParty } from "react-icons/bi";
import Link from "next/link";
import { FaPlus } from "react-icons/fa6";
import DeleteAccountModal from "../modals/DeleteAccountModal";

interface EventData {
  _id: string;
  name: string;
  date: string;
  total: number;
  arrives: number;
}

interface SessionUser {
  role?: string;
  isRPAdmin?: boolean;
}

interface EventsListProps {
  user: SessionUser;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).format(new Date(date));
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

  const isRPAdmin = user.role === "ADMINISTRADOR";
  const isNeo = user.role === "NEO";

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
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
      setEvents(data || []);
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "Error al obtener eventos"
      );
    } finally {
      setLoading(false);
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

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">

<div className="flex flex-col items-end space-y-3 mb-8 w-full md:flex-row md:items-center md:justify-between md:space-y-0 md:space-x-3">
  <h1 className="flex gap-3 text-3xl font-bold text-white text-nowrap">
    <span className="text-cyan-400">
      <BiParty />
    </span>
    Listado de Eventos!
  </h1>
  {isRPAdmin && (
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

          {events.map((event) => (
            <div
              key={event._id}
              className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg transition hover:border-slate-700"
            >

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                <div className="min-w-0">

                  <h2 className="text-3xl font-semibold text-white">
                    {event.name}

                    <span className="ml-2 text-lg font-normal text-gray-400">
                      Asisten{" "}
                      <span className="text-cyan-400">
                        {event.arrives || 0}
                      </span>{" "}
                      de{" "}
                      {event.total || 0}
                    </span>
                  </h2>

                  <span className="mt-1 block text-xl text-gray-400">
                    {formatDate(event.date)}
                  </span>

                </div>

                <div className="flex flex-wrap justify-end gap-2">

                  {isNeo && (
                    <button
                      type="button"
                      onClick={() =>
                        handleBI(event._id)
                      }
                      disabled={
                        generatingBI ===
                        event._id
                      }
                      className="rounded-lg bg-blue-600 px-3 py-2 text-3xl font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
                    >
                      {generatingBI ===
                      event._id ? (
                        "BI..."
                      ) : (
                        <>
                          ⚙ BI
                        </>
                      )}
                    </button>
                  )}

                  {(isRPAdmin || isNeo) && <button
                    type="button"
                    onClick={() =>
                      handleList(event._id)
                    }
                    className="rounded-lg bg-blue-600 px-3 py-2 text-3xl font-medium text-white transition hover:bg-blue-500"
                  >
                    ☷ Lista
                  </button>}

                  {(isRPAdmin || isNeo) && <button
                    type="button"
                    onClick={() =>
                      handleEdit(event._id)
                    }
                    className="rounded-lg bg-blue-600 px-3 py-2 text-3xl font-medium text-white transition hover:bg-blue-500"
                  >
                    ◉ Ver
                  </button>}

                  <button
                    type="button"
                    onClick={() =>
                      handleImport(event._id)
                    }
                    className="rounded-lg bg-blue-600 px-3 py-2 text-3xl font-medium text-white transition hover:bg-blue-500"
                  >
                    ↓ Importar
                  </button>

                  {isRPAdmin && (
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
                      className="rounded-lg bg-red-600 px-3 py-2 text-3xl font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
                    >
                      {deleting ===
                      event._id
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
    </main>
  );
}