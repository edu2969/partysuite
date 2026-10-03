"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { MdEditCalendar } from "react-icons/md";
import PieChart from "../prefabs/PieChart";
import VerticalRankingBar from "../prefabs/VerticalRankingBar";
import { ListeroData } from "./types";
import Loader from "../prefabs/Loader";
import {
  EVENT_TIME_ZONE,
  getEventSchedule,
} from "@/lib/eventClose";
import { getCurrentBusinessDate } from "@/lib/businessTime";

interface EventData {
  _id?: string;
  name: string;
  businessDate: string;
  startsAt?: string;
  listClosedAt: string;
  closeAt: string;
  total: number;
  arrives: number;
  averageCheckTime: number;
}

interface EventForm {
  name: string;
  businessDate: string;
  startTime: string;
  listCloseTime: string;
  closeTime: string;
}

interface EventEditProps {
  eventId?: string;
}

function formatEventTime(value: string | Date | undefined, fallback: string) {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: EVENT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export default function EventForm({ eventId }: EventEditProps) {
  const router = useRouter();

  const [event, setEvent] = useState<EventData | null>(null);
  const [listeros, setListeros] = useState<ListeroData[]>([]);
  const [loading, setLoading] = useState(!!eventId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<'torta' | 'tabla' | 'ranking'>('torta')

  const {
    register,
    handleSubmit,
    reset,
    setError: setFieldError,
    watch,
    formState: { errors },
  } = useForm<EventForm>({
    defaultValues: {
      name: "",
      businessDate: getCurrentBusinessDate(),
      startTime: "23:00",
      listCloseTime: "23:30",
      closeTime: "05:00",
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

          const event = data.event;
          setEvent(event);

          reset({
            name: event.name,
            businessDate: String(event.businessDate).slice(0, 10),
            startTime: formatEventTime(event.startsAt, "23:00"),
            listCloseTime: formatEventTime(event.listClosedAt, "23:30"),
            closeTime: formatEventTime(event.closeAt, "05:00"),
          });
        }

        const biResponse = await fetch(`/api/events/${eventId}/bi`);
        if (biResponse.ok) {
          const biData = await biResponse.json();
          console.log("biData", biData);
          setListeros(biData || []);
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
    const schedule = getEventSchedule(
      data.businessDate,
      data.startTime,
      data.listCloseTime,
      data.closeTime
    );

    if (!schedule.ok) {
      setFieldError(schedule.field, {
        type: "validate",
        message: schedule.message,
      });
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        name: data.name.trim(),
        businessDate: data.businessDate,
        startTime: data.startTime,
        listCloseTime: data.listCloseTime,
        closeTime: data.closeTime,
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
    return <Loader text="Cargando evento" />;
  }

  const handleBack = () => {
    router.back();
  }

  return (
    <main className="w-full h-screen overflow-y-scroll">
      <div className="mx-auto max-w-6xl p-2 md:p-6">
        <div className="flex justify-end md:justify-start mb-8 space-x-3 text-cyan-400">
          <MdEditCalendar size={36} />
          <h1 className="text-3xl font-bold">
            {event?._id
              ? "Editando Evento"
              : "Nuevo Evento"}
          </h1>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-8"
        >

          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-2 md:p-6">

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
                  Fecha de negocio
                </label>

                <input
                  {...register("businessDate", {
                    required: true,
                  })}
                  type="date"
                  step={60}
                  disabled={saving}
                  className="text-3xl w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500 [&::-webkit-calendar-picker-indicator]:invert"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Inicio de importaciones
                </label>

                <input
                  {...register("startTime", {
                    required: "La hora de inicio es obligatoria",
                  })}
                  type="time"
                  disabled={saving}
                  step={60}
                  className="text-3xl w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500 [&::-webkit-calendar-picker-indicator]:invert"
                />
                {errors.startTime?.message && (
                  <p className="mt-2 text-sm text-red-400">
                    {errors.startTime.message}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Cierre de importaciones
                </label>

                <input
                  {...register("listCloseTime", {
                    required: "La hora de cierre de lista es obligatoria",
                  })}
                  type="time"
                  disabled={saving}
                  step={60}
                  className="text-3xl w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500 [&::-webkit-calendar-picker-indicator]:invert"
                />
                {errors.listCloseTime?.message && (
                  <p className="mt-2 text-sm text-red-400">
                    {errors.listCloseTime.message}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Cierre del evento
                </label>

                <input
                  {...register("closeTime", {
                    required: "La hora de cierre del evento es obligatoria",
                  })}
                  type="time"
                  disabled={saving}
                  step={60}
                  max="05:00"
                  className="text-3xl w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500 [&::-webkit-calendar-picker-indicator]:invert"
                />
                {errors.closeTime?.message && (
                  <p className="mt-2 text-sm text-red-400">
                    {errors.closeTime.message}
                  </p>
                )}
              </div>

            </div>

            {error && (
              <div className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="mt-6 flex justify-end space-x-4 text-lg md:text-2xl">
              <button
                type="button"
                onClick={handleBack}
                className="rounded-lg bg-neutral-600 px-6 py-3 font-semibold text-white transition hover:bg-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ← Volver
              </button>
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
            <div className="flex gap-6" role="tablist" aria-label="Distribución de captaciones">

              <button
                type="button"
                role="tab"
                id="tab-torta"
                aria-selected={activeTab === 'torta'}
                aria-controls="panel-torta"
                onClick={() => setActiveTab('torta')}
                className={`border-b-2 px-2 pb-3 text-sm font-medium transition ${activeTab === 'torta'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-gray-400 hover:text-white'
                  }`}
              >
                Torta
              </button>

              <button
                type="button"
                role="tab"
                id="tab-tabla"
                aria-selected={activeTab === 'tabla'}
                aria-controls="panel-tabla"
                onClick={() => setActiveTab('tabla')}
                className={`border-b-2 px-2 pb-3 text-sm font-medium transition ${activeTab === 'tabla'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-gray-400 hover:text-white'
                  }`}
              >
                Tabla
              </button>

              <button
                type="button"
                role="tab"
                id="tab-ranking"
                aria-selected={activeTab === 'ranking'}
                aria-controls="panel-ranking"
                onClick={() => setActiveTab('ranking')}
                className={`border-b-2 px-2 pb-3 text-sm font-medium transition ${activeTab === 'ranking'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-gray-400 hover:text-white'
                  }`}
              >
                Ranking
              </button>

            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">

            {activeTab === 'torta' && (<div className="flex min-h-100 items-center justify-center rounded-lg bg-slate-950/50">
              <PieChart listeros={listeros} />
            </div>)}

            {activeTab === 'tabla' && (<div className="overflow-x-auto min-h-100">

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

                  {listeros.map((biReg, index) => (
                    <tr
                      key={biReg._id}
                      className="border-b border-slate-800 text-gray-300"
                    >
                      <td className="px-3 py-3">
                        {index + 1}. {biReg.userId.name}
                      </td>

                      <td className="px-3 py-3">
                        {biReg.asisten} de {biReg.inscritos}
                      </td>

                      <td className="px-3 py-3 text-cyan-400">
                        {biReg.asisten == 0 ? 0 : (100 * biReg.asisten / biReg.inscritos).toFixed(1)}%
                      </td>

                      <td className="px-3 py-3 text-cyan-400">
                        {biReg.asisten}
                      </td>
                    </tr>
                  ))}

                  {listeros.length === 0 && (
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
            </div>)}

            {activeTab === 'ranking' && (<div className="flex min-h-100 items-center justify-center rounded-lg bg-slate-950/50">
              <VerticalRankingBar totals={listeros.map((rp) => {
                return {
                  name: rp.userId.name,
                  total: rp.asisten
                }
              }).sort((a, b) => b.total - a.total)} />
            </div>)}

          </div>
        </section>
      </div>
    </main>
  );
}
