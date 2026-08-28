"use client";

import { useEffect, useState } from "react";
import PieChart from "../prefabs/PieChart";
import VerticalRankingBar from "../prefabs/VerticalRankingBar";
import Loader from "../prefabs/Loader";
import { RPData } from "../events/types";
import { FaChartColumn } from "react-icons/fa6";
// Mismo helper que EventForm (formatDateInput), para que el <input type="date">
// muestre/reciba YYYY-MM-DD en hora LOCAL, no UTC.
function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function primerDiaDelMes() {
  const hoy = new Date();
  return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
}

export default function BiRangeView() {
  // Por defecto: día 1 del mes actual → hoy.
  const [desde, setDesde] = useState(() => formatDateInput(primerDiaDelMes()));
  const [hasta, setHasta] = useState(() => formatDateInput(new Date()));

  const [rps, setRps] = useState<RPData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"torta" | "tabla" | "ranking">(
    "torta"
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        // "T00:00:00" fuerza hora LOCAL (mismo truco que usa EventForm al
        // guardar un evento), para no correrse un día por interpretación UTC.
        const params = new URLSearchParams({
          desde: `${desde}T00:00:00`,
          hasta: `${hasta}T00:00:00`,
        });

        const response = await fetch(`/api/events/bi?${params.toString()}`);

        if (!response.ok) {
          const result = await response.json().catch(() => null);
          throw new Error(result?.message || "No fue posible cargar el BI");
        }

        const data: RPData[] = await response.json();

        if (!cancelled) {
          setRps(data || []);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "No fue posible cargar el BI"
          );
          setRps([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [desde, hasta]);

  return (
    <main className="w-full h-screen overflow-y-scroll">
      <div className="mx-auto max-w-6xl p-6">
        <h1 className="flex justify-end space-x-4 md:justify-center mb-8 text-3xl font-bold text-cyan-400">
          <FaChartColumn /><span className="text-white">Estadísticas</span>
        </h1>

        <section className="mb-8 rounded-xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="mb-6 text-xl font-semibold text-white">
            Rango de fechas
          </h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Desde
              </label>
              <input
                type="date"
                value={desde}
                max={hasta}
                onChange={(e) => setDesde(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Hasta
              </label>
              <input
                type="date"
                value={hasta}
                min={desde}
                onChange={(e) => setHasta(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {error && (
            <div className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="mb-6 text-xl font-semibold text-white">
            Distribución de captaciones
          </h2>

          <div className="mb-6 border-b border-slate-700">
            <div
              className="flex gap-6"
              role="tablist"
              aria-label="Distribución de captaciones"
            >
              <button
                type="button"
                role="tab"
                id="tab-torta"
                aria-selected={activeTab === "torta"}
                aria-controls="panel-torta"
                onClick={() => setActiveTab("torta")}
                className={`border-b-2 px-2 pb-3 text-sm font-medium transition ${
                  activeTab === "torta"
                    ? "border-cyan-500 text-cyan-400"
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                Torta
              </button>

              <button
                type="button"
                role="tab"
                id="tab-tabla"
                aria-selected={activeTab === "tabla"}
                aria-controls="panel-tabla"
                onClick={() => setActiveTab("tabla")}
                className={`border-b-2 px-2 pb-3 text-sm font-medium transition ${
                  activeTab === "tabla"
                    ? "border-cyan-500 text-cyan-400"
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                Tabla
              </button>

              <button
                type="button"
                role="tab"
                id="tab-ranking"
                aria-selected={activeTab === "ranking"}
                aria-controls="panel-ranking"
                onClick={() => setActiveTab("ranking")}
                className={`border-b-2 px-2 pb-3 text-sm font-medium transition ${
                  activeTab === "ranking"
                    ? "border-cyan-500 text-cyan-400"
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                Ranking
              </button>
            </div>
          </div>

          {loading ? (
            <Loader text="Cargando BI" />
          ) : (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              {activeTab === "torta" && (
                <div
                  id="panel-torta"
                  role="tabpanel"
                  aria-labelledby="tab-torta"
                  className="flex min-h-100 items-center justify-center rounded-lg bg-slate-950/50"
                >
                  <PieChart rps={rps} />
                </div>
              )}

              {activeTab === "tabla" && (
                <div
                  id="panel-tabla"
                  role="tabpanel"
                  aria-labelledby="tab-tabla"
                  className="overflow-x-auto min-h-100"
                >
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
                          key={biReg.rpId._id}
                          className="border-b border-slate-800 text-gray-300"
                        >
                          <td className="px-3 py-3">
                            {index + 1}. {biReg.rpId.name}
                          </td>

                          <td className="px-3 py-3">
                            {biReg.asisten} de {biReg.inscritos}
                          </td>

                          <td className="px-3 py-3 text-cyan-400">
                            {biReg.inscritos > 0
                              ? (
                                  (biReg.asisten / biReg.inscritos) *
                                  100
                                ).toFixed(1)
                              : "0.0"}
                            %
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
                            No existen captaciones registradas en este período
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "ranking" && (
                <div
                  id="panel-ranking"
                  role="tabpanel"
                  aria-labelledby="tab-ranking"
                  className="flex min-h-100 items-center justify-center rounded-lg bg-slate-950/50"
                >
                  <VerticalRankingBar
                    totals={rps
                      .map((rp) => ({
                        name: rp.rpId.name,
                        total: rp.asisten,
                      }))
                      .sort((a, b) => b.total - a.total)}
                  />
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
