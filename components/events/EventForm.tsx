"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

interface EventData {
  _id?: string;
  name: string;
  date: string;
  closeTime: number;
  total: number;
  arrives: number;
  averageCheckTime: number;
  male?: number;
  female?: number;
}

interface RPData {
  _id: string;
  asisten: number;
  createdAt: Date;
  eventoId: string;
  inscritos: number;
  rpId: {
    _id: string;
    email: string;
    role: string;
    name: string;
  }
  updatedAt: Date;
}

interface EventForm {
  name: string;
  date: string;
  closeTime: string;
}

interface EventEditProps {
  eventId?: string;
}

function formatDateInput(date: string | Date) {
  const d = new Date(date);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatCloseTime(ms: number) {
  const totalMinutes = Math.floor(ms / 60000);

  let hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  hours = hours % 24;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}`;
}

function timeToMilliseconds(time: string) {
  const [hours, minutes] = time.split(":").map(Number);

  return (
    hours * 60 * 60 * 1000 +
    minutes * 60 * 1000
  );
}

export default function EventForm({ eventId }: EventEditProps) {
  const router = useRouter();

  const [event, setEvent] = useState<EventData | null>(null);
  const [rps, setRps] = useState<RPData[]>([]);
  const [loading, setLoading] = useState(!!eventId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    reset,
  } = useForm<EventForm>({
    defaultValues: {
      name: "",
      date: formatDateInput(new Date()),
      closeTime: "01:30",
    },
  });

  useEffect(() => {
    const load = async () => {
      try {
        if (eventId !== "new") {
          const response = await fetch(
            `/api/events/${eventId}`
          );

          if (!response.ok) {
            throw new Error("No fue posible cargar el evento");
          }

          const data = await response.json();

          setEvent(data);

          reset({
            name: data.name,
            date: formatDateInput(data.date),
            closeTime: formatCloseTime(data.closeTime),
          });
        } 

        const biResponse = await fetch(`/api/events/${eventId}/bi`);        
        if (biResponse.ok) {
          const biData = await biResponse.json();
          console.log("BiResponse", biData);
          setRps(biData || []);
        }
      } catch (err) {
        console.error(err);
        setError("No fue posible cargar la información");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [eventId, reset]);

  const onSubmit = async (data: EventForm) => {
    setSaving(true);
    setError("");

    try {
      const payload = {
        name: data.name.trim(),
        date: new Date(`${data.date}T00:00:00`).toISOString(),
        closeTime: timeToMilliseconds(data.closeTime),
      };

      const response = await fetch(
        eventId !== "new"
          ? `/api/events/${eventId}`
          : `/api/events`,
        {
          method: eventId !== "new" ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.message || "No fue posible guardar el evento"
        );
      }

      router.push("/events");
      router.refresh();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "No fue posible guardar el evento"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-100 items-center justify-center text-gray-400">
        Cargando evento...
      </div>
    );
  }

  const totalArrives = event?.arrives || 0;

  return (
    <main className="mx-auto w-full max-w-6xl p-6 h-screen overflow-y-scroll">

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          {event?._id
            ? "Editando Evento"
            : "Nuevo Evento"}
        </h1>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-8"
      >

        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">

          <h2 className="mb-6 text-xl font-semibold text-white">
            Datos básicos
          </h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Nombre
              </label>

              <input
                {...register("name", {
                  required: true,
                })}
                placeholder="Evento"
                disabled={saving}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Fecha
              </label>

              <input
                {...register("date", {
                  required: true,
                })}
                type="date"
                disabled={saving}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Cierre de lista
              </label>

              <input
                {...register("closeTime", {
                  required: true,
                })}
                type="time"
                disabled={saving}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500"
              />
            </div>

          </div>

          {error && (
            <div className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>

        </section>

      </form>

      <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/70 p-6">

        <h2 className="mb-6 text-xl font-semibold text-white">
          Distribución de captaciones
        </h2>

        <div className="mb-6 border-b border-slate-700">
          <div className="flex gap-6">

            <button
              type="button"
              className="border-b-2 border-cyan-500 px-2 pb-3 text-sm font-medium text-cyan-400"
            >
              Torta
            </button>

            <button
              type="button"
              className="px-2 pb-3 text-sm font-medium text-gray-400 hover:text-white"
            >
              Tabla
            </button>

          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">

          <div className="flex min-h-100 items-center justify-center rounded-lg bg-slate-950/50">
            <PieChart rps={rps} />
          </div>

          <div className="overflow-x-auto">

            <table className="w-full text-left text-sm">

              <thead>
                <tr className="border-b border-slate-700 text-gray-400">
                  <th className="px-3 py-3">RP</th>
                  <th className="px-3 py-3">Lista</th>
                  <th className="px-3 py-3">% Efec</th>
                  <th className="px-3 py-3">% Asis</th>
                </tr>
              </thead>

              <tbody>

                {rps.map((biReg, index) => (
                  <tr
                    key={biReg._id}
                    className="border-b border-slate-800 text-gray-300"
                  >
                    <td className="px-3 py-3">
                      {index + 1}. {biReg.rpId.name}
                    </td>

                    <td className="px-3 py-3">
                      {biReg.asisten} de {biReg.inscritos}
                    </td>

                    <td className="px-3 py-3 text-cyan-400">
                      {(biReg.inscritos / biReg.asisten * 100).toFixed(1)}%
                    </td>

                    <td className="px-3 py-3 text-cyan-400">
                      {biReg.asisten}
                    </td>
                  </tr>
                ))}

                {rps.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-10 text-center text-gray-500"
                    >
                      No existen captaciones registradas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

function PieChart({
  rps,
}: {
  rps: RPData[];
}) {
  console.log("RPs", rps)
  const total = rps.reduce(
    (sum, rp) => sum + (rp.asisten || 0),
    0
  );

  if (!total) {
    return (
      <span className="text-sm text-gray-500">
        No existen asistencias para mostrar
      </span>
    );
  }

  let accumulated = 0;

  const colors = [
    "#7e3838",
    "#7e6538",
    "#7c7e38",
    "#587e38",
    "#387e45",
    "#387e6a",
    "#386a7e",
    "#f00",
    "#0f0",
    "#00f",
    "#ff0",
    "#f0f",
    "#0ff",
  ];

  const gradient = rps
    .filter((rp) => rp.asisten > 0)
    .map((rp, index) => {
      const start = accumulated;
      const percentage = (rp.asisten / total) * 100;
      accumulated += percentage;

      return `${colors[index % colors.length]} ${start}% ${accumulated}%`;
    })
    .join(", ");

  return (
    <div className="flex flex-col items-center gap-5">

      <div
        className="h-72 w-72 rounded-full"
        style={{
          background: `conic-gradient(${gradient})`,
        }}
      />

      <div className="flex flex-wrap justify-center gap-3">
        {rps
          .filter((rp) => rp.asisten > 0)
          .map((rp, index) => (
            <div
              key={rp._id}
              className="flex items-center gap-2 text-xs text-gray-300"
            >
              <span
                className="h-3 w-3 rounded-sm"
                style={{
                  backgroundColor:
                    colors[index % colors.length],
                }}
              />

              {rp.rpId.name} ({rp.asisten})
            </div>
          ))}
      </div>

    </div>
  );
}