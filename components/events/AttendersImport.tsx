"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getEventCountdownStart } from "@/lib/eventClose";

interface EventData {
  _id: string;
  name: string;
  businessDate: string;
  startsAt?: string;
  listClosedAt: string;
  closeAt: string;
  importDeadline: string | null;
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

interface ImportJob {
  id: string;
  number: number;
  total: number;
  processed: number;
  status: "processing" | "completed" | "error";
  messages: ImportMessages;
  error?: string;
}

type ImportStreamEvent =
  | {
      type: "progress";
      processed: number;
      total: number;
      messages: ImportMessages;
    }
  | { type: "completed"; totalImported: number }
  | { type: "error"; message: string };

interface AttendersImportProps {
  eventId: string;
}

const MESSAGE_SECTIONS = [
  {
    key: "success",
    label: "Importados",
    symbol: "✓",
    styles: "text-green-300",
  },
  {
    key: "warning",
    label: "Advertencias",
    symbol: "⚠",
    styles: "text-yellow-300",
  },
  {
    key: "danger",
    label: "No importados",
    symbol: "×",
    styles: "text-red-300",
  },
] as const;

function appendMessages(
  current: ImportMessages,
  incoming: ImportMessages
): ImportMessages {
  const wrongRuts = `${current.wrongRuts ?? ""}${incoming.wrongRuts ?? ""}`;

  return {
    success: [...(current.success ?? []), ...(incoming.success ?? [])],
    warning: [...(current.warning ?? []), ...(incoming.warning ?? [])],
    danger: [...(current.danger ?? []), ...(incoming.danger ?? [])],
    wrongRuts: wrongRuts || undefined,
  };
}

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export default function AttendersImport({
  eventId,
}: AttendersImportProps) {
  const router = useRouter();

  const [text, setText] = useState("");
  const [messages, setMessages] = useState<ImportMessages | null>(null);
  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);
  const [startingImport, setStartingImport] = useState(false);
  const startingImportRef = useRef(false);
  const importSequence = useRef(0);
  const [now, setNow] = useState<number | null>(null);
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

  const deadline = event?.importDeadline
    ? new Date(event.importDeadline).getTime()
    : Number.NaN;
  const storedStart = event?.startsAt
    ? new Date(event.startsAt).getTime()
    : Number.NaN;
  const progressStart = Number.isFinite(storedStart)
    ? storedStart
    : event
      ? getEventCountdownStart(event.businessDate)?.getTime() ?? Number.NaN
      : Number.NaN;

  useEffect(() => {
    if (!Number.isFinite(deadline)) return;

    let timeout: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const timestamp = Date.now();
      setNow(timestamp);

      if (timestamp < deadline) {
        timeout = setTimeout(tick, Math.min(1_000, deadline - timestamp));
      }
    };

    tick();
    return () => {
      if (timeout !== undefined) clearTimeout(timeout);
    };
  }, [deadline]);

  const hasValidDeadline = Number.isFinite(deadline);
  const deadlinePassed =
    hasValidDeadline && Date.now() >= deadline;
  const remainingTime = now === null ? null : Math.max(0, deadline - now);
  const progressDuration = deadline - progressStart;
  const remainingRatio = progressDuration > 0
    ? Math.max(
        0,
        Math.min(
          (deadline - Math.max(now ?? progressStart, progressStart)) / progressDuration,
          1
        )
      )
    : 0;
  const elapsedRatio = 1 - remainingRatio;
  const urgency = elapsedRatio >= 0.9 ? "red" : elapsedRatio >= 0.1 ? "amber" : "green";
  const colors = {
    green: { text: "text-emerald-400", fill: "bg-emerald-500" },
    amber: { text: "text-amber-300", fill: "bg-amber-400" },
    red: { text: "text-red-400", fill: "bg-red-500" },
  }[urgency];

  const handleImport = async () => {
    if (startingImportRef.current) return;

    if (!hasValidDeadline || Date.now() >= deadline) {
      setMessages({
        danger: [
          {
            item: hasValidDeadline
              ? "Ya no será posible importar."
              : "No se pudo verificar el plazo de importación.",
          },
        ],
      });
      return;
    }

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

    const jobNumber = ++importSequence.current;
    const jobId = `${Date.now()}-${jobNumber}`;
    startingImportRef.current = true;
    setStartingImport(true);
    let isStartingRequest = true;
    const releaseStartingRequest = () => {
      if (!isStartingRequest) return;
      isStartingRequest = false;
      startingImportRef.current = false;
      setStartingImport(false);
    };
    setMessages(null);
    setText("");
    setImportJobs((current) => [
      ...current,
      {
        id: jobId,
        number: jobNumber,
        total: entradas.length,
        processed: 0,
        status: "processing",
        messages: {},
      },
    ]);

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

      if (!response.ok) {
        let errorMessages: ImportMessages = {};
        try {
          errorMessages = await response.json();
        } catch {
          errorMessages = {};
        }
        const errorMessage =
          errorMessages.danger?.map((message) => message.item).join("\n") ||
          "No fue posible realizar la importación";
        setImportJobs((current) =>
          current.map((job) =>
            job.id === jobId
              ? {
                  ...job,
                  status: "error",
                  error: errorMessage,
                  messages: appendMessages(job.messages, errorMessages),
                }
              : job
          )
        );
        return;
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/x-ndjson")) {
        const result: ImportMessages = await response.json();
        if (!result.danger?.length) {
          throw new Error("La respuesta de importación no contiene avances");
        }
        const errorMessage = result.danger
          .map((message) => message.item)
          .join("\n");
        setImportJobs((current) =>
          current.map((job) =>
            job.id === jobId
              ? {
                  ...job,
                  status: "error",
                  error: errorMessage,
                  messages: appendMessages(job.messages, result),
                }
              : job
          )
        );
        return;
      }

      if (!response.body) {
        throw new Error("La respuesta de importación no contiene avances");
      }

      releaseStartingRequest();

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedTerminalEvent = false;

      const handleEvent = (line: string) => {
        if (!line.trim()) return;

        const event = JSON.parse(line) as ImportStreamEvent;
        if (event.type === "progress") {
          setImportJobs((current) =>
            current.map((job) =>
              job.id === jobId
                ? {
                    ...job,
                    processed: event.processed,
                    messages: appendMessages(job.messages, event.messages),
                  }
                : job
            )
          );
        } else if (event.type === "completed") {
          receivedTerminalEvent = true;
          setImportJobs((current) =>
            current.map((job) =>
              job.id === jobId
                ? {
                    ...job,
                    processed: job.total,
                    status: "completed",
                  }
                : job
            )
          );
        } else if (event.type === "error") {
          receivedTerminalEvent = true;
          setImportJobs((current) =>
            current.map((job) =>
              job.id === jobId
                ? { ...job, status: "error", error: event.message }
                : job
            )
          );
        } else {
          throw new Error("Se recibió un avance de importación inválido");
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          lines.forEach(handleEvent);
        }

        buffer += decoder.decode();
        handleEvent(buffer);

        if (!receivedTerminalEvent) {
          throw new Error("La conexión terminó antes de completar la importación");
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error(error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Error al importar invitados";
      setImportJobs((current) =>
        current.map((job) =>
          job.id === jobId
            ? {
                ...job,
                status: "error",
                error: errorMessage,
                messages: appendMessages(job.messages, {
                  danger: [{ item: errorMessage }],
                }),
              }
            : job
        )
      );
    } finally {
      releaseStartingRequest();
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

        <div className={`mt-4 border-y px-3 py-3 ${deadlinePassed ? "border-red-500/40 bg-red-500/5" : "border-slate-700 bg-slate-900/50"}`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="text-sm font-medium text-gray-300">Tiempo restante para importar</span>
            {deadlinePassed ? (
              <span className="font-semibold text-red-400" role="status">
                Ya no será posible importar.
              </span>
            ) : hasValidDeadline ? (
              <time
                className={`font-mono text-xl font-semibold tabular-nums ${colors.text}`}
                role="timer"
                aria-live="off"
              >
                {remainingTime === null ? "--:--:--" : formatCountdown(remainingTime)}
              </time>
            ) : (
              <span className="text-sm text-red-400" role="status">
                No se pudo determinar el cierre de importación.
              </span>
            )}
          </div>
          {hasValidDeadline && (
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
          disabled={
            !hasValidDeadline ||
            deadlinePassed
          }
          className="block w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-md text-gray-100 shadow-sm outline-none transition placeholder:text-gray-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-50"
        />
      </div>

      <div className="w-full h-4 overflow-hidden rounded-full bg-slate-200 shadow-inner">
        <div className="relative h-full overflow-hidden rounded-full bg-linear-to-r from-cyan-400 via-blue-500 to-purple-600 shadow-[0_0_14px_rgba(59,130,246,0.8)] transition-all duration-500 ease-out"
          style={{
            width: `${event.maxImport > 0
              ? Math.min(Math.floor(event.actualImported / event.maxImport * 100), 100)
              : 0}%`,
          }}>
          <div className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/50 to-transparent" />
        </div>        
      </div>
      <span>
        <b>{event.maxImport > 0
          ? Math.min(Math.floor(event.actualImported / event.maxImport * 100), 100)
          : 0}%</b>{" "}
        <small>({event.actualImported} / {event.maxImport})</small>
      </span>

      {importJobs.length > 0 && (
        <section className="space-y-3 pt-2" aria-label="Progreso de importaciones">
          {importJobs.map((job) => {
            const progress = job.total > 0
              ? Math.floor((job.processed / job.total) * 100)
              : 100;
            const messageCount =
              (job.messages.success?.length ?? 0) +
              (job.messages.warning?.length ?? 0) +
              (job.messages.danger?.length ?? 0);

            return (
              <article
                key={job.id}
                className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/70 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h5 className="font-semibold text-white">
                    Lista {job.number}
                  </h5>
                  <span
                    className={
                      job.status === "error"
                        ? "text-red-400"
                        : job.status === "completed"
                          ? "text-emerald-400"
                          : "text-cyan-300"
                    }
                    role="status"
                  >
                    {job.status === "error"
                      ? "Error"
                      : job.status === "completed"
                        ? "Completada"
                        : "Procesando"}
                  </span>
                </div>
                <div
                  className="h-3 overflow-hidden rounded-full bg-slate-700"
                  role="progressbar"
                  aria-label={`Avance de importación de la lista ${job.number}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                >
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 ${
                      job.status === "error"
                        ? "bg-red-500"
                        : "bg-linear-to-r from-cyan-400 to-blue-500"
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-300">
                  {progress}% ({job.processed} / {job.total} filas)
                </p>
                {job.error && (
                  <p className="text-sm text-red-300" role="alert">
                    {job.error}
                  </p>
                )}
                {(messageCount > 0 || job.messages.wrongRuts) && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-gray-300">
                      Ver resultados ({messageCount})
                    </summary>
                    <div className="mt-2 space-y-2">
                      {MESSAGE_SECTIONS.map((section) => {
                        const items = job.messages[section.key];
                        if (!items?.length) return null;

                        return (
                          <div key={section.key} className={section.styles}>
                            <p className="font-semibold">{section.label}</p>
                            {items.map((message, index) => (
                              <p key={`${section.key}-${index}`}>
                                {section.symbol} {message.item}
                              </p>
                            ))}
                          </div>
                        );
                      })}
                      {job.messages.wrongRuts && (
                        <pre className="whitespace-pre-wrap text-yellow-200">
                          RUT para corregir:
                          {"\n"}
                          {job.messages.wrongRuts.trimEnd()}
                        </pre>
                      )}
                    </div>
                  </details>
                )}
              </article>
            );
          })}
        </section>
      )}

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
          disabled={
            startingImport ||
            event.maxImport <= 0 ||
            !hasValidDeadline ||
            deadlinePassed
          }
          className="w-3/5 flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {startingImport ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Iniciando...
            </>
          ) : (
            <>
              <span>↓</span>
              {importJobs.length > 0 ? "Importar otra lista" : "Importar"}
            </>
          )}
        </button>
      </div>

    </div>
  </main>
  );
}