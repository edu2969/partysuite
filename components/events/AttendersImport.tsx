"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface EventData {
  _id: string;
  name: string;
  closeAt: string;
  maxImport: number;
  actualImported: number;
}

interface MessageItem {
  item: string;
}

interface ImportMessages {
  danger?: MessageItem[];
  warning?: MessageItem[];
  success?: MessageItem[];
  wrongRuts?: string;
}

interface AttendersImportProps {
  eventId: string;
}

export default function AttendersImport({
  eventId,
}: AttendersImportProps) {
  const router = useRouter();

  const [text, setText] = useState("");
  const [messages, setMessages] = useState<ImportMessages | null>(null);
  const [importing, setImporting] = useState(false);
  const queryClient = useQueryClient()

  const { data: event, isLoading: isLoadingEvent } = useQuery<EventData>({
    queryKey: ["event", eventId],
    queryFn: async() => {
      const response = await fetch(
        `/api/events/${eventId}`
      );

      if (!response.ok) {
        throw new Error("No fue posible cargar el evento");
      }

      const data = await response.json();
      return data.event;
    }
  })

  const handleImport = async () => {
    if (importing) return;

    setMessages(null);

    const text2Import = text.trim();

    if (!text2Import.length) {
      setMessages({
        danger: [
          {
            item: "Se requieren datos para importar",
          },
        ],
      });

      return;
    }

    const entradas = text2Import
      .split(/\r\n|\n|\r/)
      .map((entrada) => entrada.trim())
      .filter(Boolean);

    setImporting(true);

    try {
      const response = await fetch(
        "/api/events/import",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            entradas,
            eventId,
          }),
        }
      );

      const data: ImportMessages = await response.json();

      if (!response.ok && !data.danger) {
        setText(entradas.join("/n"));
        throw new Error(
          "No fue posible realizar la importación"
        );
      }

      setMessages(data);

      setText(data.wrongRuts || "");
    } catch (error) {
      console.error(error);
      setText(entradas.join("/n"));

      setMessages({
        danger: [
          {
            item:
              error instanceof Error
                ? error.message
                : "Error al importar invitados",
          },
        ],
      });
    } finally {
      setImporting(false);
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      e.ctrlKey &&
      e.key === "Enter"
    ) {
      handleImport();
    }
  };

  const handleBack = () => {
    router.back();
  }

  if (isLoadingEvent) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <span className="text-gray-400">
          Cargando evento...
        </span>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="flex w-full min-h-screen items-center justify-center">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-red-400">
            Evento no encontrado
          </h3>

          <button
            type="button"
            onClick={() => router.back()}
            className="mt-4 rounded-md bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-600"
          >
            Volver
          </button>
        </div>
      </main>
    );
  }

  return (<main className="w-full h-screen overflow-y-auto">
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">

      <div className="mb-6">
        <h3 className="flex justify-end ml-12 md:justify-start gap-2 text-xl md:text-3xl font-semibold text-white text-right">
          {event.name}
        </h3>

        <h4 className="text-right mt-2 text-lg text-gray-300">
          Importación de Invitados
        </h4>

        <div className="flex flex-col mt-3 gap-2 rounded-md bg-yellow-500/10 px-3 py-2 text-2xl text-yellow-300">
          <p className="text-xl text-white">Pega acá una lista de invitados</p>
          <div className="flex">
            <p className="mr-4 text-4xl mt-3">⚠</p>
            <p><small>Formato:</small> <br />[Nombre(s) Apellido(s) Rut]</p>
          </div>
        </div>
      </div>

      <div className="mb-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Ejemplo:
Juan Perez 12.345.678-5
Maria Gonzalez 15234567-8`}
          rows={8}
          disabled={importing}
          className="block w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-md text-gray-100 shadow-sm outline-none transition placeholder:text-gray-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-50"
        />
      </div>

      <div className="w-full h-4 overflow-hidden rounded-full bg-slate-200 shadow-inner">
      <div
          className="relative h-full overflow-hidden rounded-full bg-linear-to-r from-cyan-400 via-blue-500 to-purple-600 shadow-[0_0_14px_rgba(59,130,246,0.8)] transition-all duration-500 ease-out"
          style={{ width: `${Math.floor(event.actualImported / event.maxImport * 100)}%` }}
        >
          <div className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/50 to-transparent" />    
        </div>        
      </div>
      {event && <span><b>{Math.floor(event.actualImported / event.maxImport * 100)}%</b> <small>({event.actualImported} / {event.maxImport}</small></span>})

      {messages && (
        <div className="space-y-3 pt-2">

          {messages.danger &&
            messages.danger.length > 0 && (
              <div
                className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-xl text-red-300"
                role="alert"
              >
                {messages.danger.map(
                  (message, index) => (
                    <div
                      key={`danger-${index}`}
                      className="flex items-start gap-2 py-1"
                    >
                      <span className="font-bold">
                        ×
                      </span>

                      <span>
                        {message.item}
                      </span>
                    </div>
                  )
                )}
              </div>
            )}

          {messages.warning &&
            messages.warning.length > 0 && (
              <div
                className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-xl text-yellow-300"
                role="alert"
              >
                {messages.warning.map(
                  (message, index) => (
                    <div
                      key={`warning-${index}`}
                      className="flex items-start gap-2 py-1"
                    >
                      <span className="font-bold">
                        ⚠
                      </span>

                      <span>
                        {message.item}
                      </span>
                    </div>
                  )
                )}
              </div>
            )}

          {messages.success &&
            messages.success.length > 0 && (
              <div
                className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-xl text-green-300"
                role="alert"
              >
                {messages.success.map(
                  (message, index) => (
                    <div
                      key={`success-${index}`}
                      className="flex items-start gap-2 py-1"
                    >
                      <span className="font-bold">
                        ✓
                      </span>

                      <span>
                        {message.item}
                      </span>
                    </div>
                  )
                )}
              </div>
            )}

        </div>
      )}

      <div className="flex mt-6 space-x-4 text-lg md:text-2xl justify-end">
        <button
          onClick={handleBack}
          className="w-2/5 rounded-lg bg-neutral-600 px-6 py-3 font-semibold text-white transition hover:bg-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ← Volver
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={importing || event.maxImport <= 0}
          className="w-3/5 flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {importing ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Importando...
            </>
          ) : (
            <>
              <span>↓</span>
              Importar
            </>
          )}
        </button>
      </div>

    </div>
  </main>
  );
}