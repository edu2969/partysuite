"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface EventData {
  _id: string;
  name: string;
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

  const [event, setEvent] = useState<EventData | null>(null);
  const [text, setText] = useState("");
  const [messages, setMessages] =
    useState<ImportMessages | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const response = await fetch(
          `/api/events/${eventId}`
        );

        if (!response.ok) {
          throw new Error("No fue posible cargar el evento");
        }

        const data = await response.json();
        setEvent(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [eventId]);

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
        console.log("DATA", entradas.join("/n"));
        setText(entradas.join("/n"));
        throw new Error(
          "No fue posible realizar la importación"
        );
      }

      setMessages(data);

      setText(data.wrongRuts || "");
    } catch (error) {
      console.error(error);
      console.log("DATA", entradas.join("/n"));
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

  if (loading) {
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
      <main className="flex min-h-screen items-center justify-center">
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

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">

      <div className="mb-6">
        <h3 className="flex items-center gap-2 text-3xl font-semibold text-white">
          <span>↓</span>
          {event.name}
        </h3>

        <h4 className="mt-2 text-lg text-gray-300">
          Importación de Invitados
        </h4>

        <div className="flex flex-col mt-3 gap-2 rounded-md bg-yellow-500/10 px-3 py-2 text-xl text-yellow-300">
          <p className="text-sm">Pega acá una lista de invitados</p>
          <div className="flex">
          <p className="mr-4">⚠</p>          
          Formato: [Nombre(s) Apellido(s) Rut]
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
          className="block w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-sm text-gray-100 shadow-sm outline-none transition placeholder:text-gray-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-50"
        />
      </div>

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

      <div className="mt-6">
        <button
          type="button"
          onClick={handleImport}
          disabled={importing}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-2xl font-semibold text-white shadow-sm transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:cursor-not-allowed disabled:opacity-50"
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

    </main>
  );
}