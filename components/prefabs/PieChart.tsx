"use client";

import { useState } from "react";
import { ListeroData } from "../events/types";

const CHART_CENTER = 140;
const CHART_RADIUS = 118;
const SLICE_COLORS = [
  "#22d3ee",
  "#fb923c",
  "#a3e635",
  "#f472b6",
  "#818cf8",
  "#facc15",
  "#2dd4bf",
  "#fb7185",
  "#60a5fa",
  "#c084fc",
  "#4ade80",
  "#f97316",
  "#a1a1aa",
];

interface PieSlice {
  id: string;
  name: string;
  value: number;
  percentage: number;
  color: string;
  startAngle: number;
  endAngle: number;
}

function pointOnCircle(angle: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: CHART_CENTER + CHART_RADIUS * Math.cos(radians),
    y: CHART_CENTER + CHART_RADIUS * Math.sin(radians),
  };
}

function describeSlice(startAngle: number, endAngle: number) {
  const sweep = endAngle - startAngle;
  const start = pointOnCircle(startAngle);

  if (sweep >= 359.999) {
    const opposite = pointOnCircle(startAngle + 180);
    return [
      `M ${CHART_CENTER} ${CHART_CENTER}`,
      `L ${start.x} ${start.y}`,
      `A ${CHART_RADIUS} ${CHART_RADIUS} 0 1 1 ${opposite.x} ${opposite.y}`,
      `A ${CHART_RADIUS} ${CHART_RADIUS} 0 1 1 ${start.x} ${start.y}`,
      "Z",
    ].join(" ");
  }

  const end = pointOnCircle(endAngle);
  const largeArc = sweep > 180 ? 1 : 0;

  return [
    `M ${CHART_CENTER} ${CHART_CENTER}`,
    `L ${start.x} ${start.y}`,
    `A ${CHART_RADIUS} ${CHART_RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

export default function PieChart({
  listeros,
  totalAsistentes,
}: {
  listeros: ListeroData[];
  totalAsistentes?: number;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listeroTotal = listeros.reduce(
    (sum, listero) => sum + Math.max(listero.asisten || 0, 0),
    0
  );
  const denominator = totalAsistentes ?? listeroTotal;

  if (!listeroTotal) {
    return (
      <span className="text-sm text-gray-500">
        No existen asistentes para mostrar
      </span>
    );
  }

  const chartTotal = Math.max(denominator, listeroTotal);
  const slices: PieSlice[] = [];
  let angle = -90;

  listeros
    .filter((listero) => listero.asisten > 0)
    .forEach((listero, index) => {
      const value = listero.asisten;
      const sweep = (value / chartTotal) * 360;
      slices.push({
        id: `user-${listero._id}`,
        name: listero.userId.name,
        value,
        percentage: denominator > 0 ? (value / denominator) * 100 : 0,
        color: SLICE_COLORS[index % SLICE_COLORS.length],
        startAngle: angle,
        endAngle: angle + sweep,
      });
      angle += sweep;
    });

  const unattributed = Math.max(chartTotal - listeroTotal, 0);
  if (unattributed > 0) {
    const sweep = (unattributed / chartTotal) * 360;
    slices.push({
      id: "other-attendees",
      name: "Otros asistentes",
      value: unattributed,
      percentage: denominator > 0 ? (unattributed / denominator) * 100 : 0,
      color: "#475569",
      startAngle: angle,
      endAngle: angle + sweep,
    });
  }

  const selectedSlice = slices.find((slice) => slice.id === selectedId);
  const toggleSlice = (sliceId: string) => {
    setSelectedId((current) => current === sliceId ? null : sliceId);
  };

  return (
    <div className="flex w-full flex-col items-center gap-5 py-2">
      <svg
        viewBox="0 0 280 280"
        className="h-64 w-64 overflow-visible sm:h-72 sm:w-72"
        role="group"
        aria-label="Distribución de asistentes por RP"
      >
        {slices.map((slice) => {
          const selected = selectedId === slice.id;
          const midAngle = (slice.startAngle + slice.endAngle) / 2;
          const radians = (midAngle * Math.PI) / 180;
          const offset = selected ? 7 : 0;

          return (
            <path
              key={slice.id}
              d={describeSlice(slice.startAngle, slice.endAngle)}
              fill={slice.color}
              stroke="#0f172a"
              strokeWidth="1.5"
              role="button"
              tabIndex={0}
              aria-label={`${slice.name}: ${slice.value} asistentes, ${slice.percentage.toFixed(1)}%`}
              aria-pressed={selected}
              onClick={() => toggleSlice(slice.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleSlice(slice.id);
                }
              }}
              className="cursor-pointer outline-none transition-[transform,filter,opacity] duration-300 ease-out focus-visible:stroke-white focus-visible:stroke-[3px]"
              style={{
                transform: `translate(${Math.cos(radians) * offset}px, ${Math.sin(radians) * offset}px)`,
                filter: selected ? "drop-shadow(0 5px 8px rgb(0 0 0 / 0.4))" : "none",
                opacity: selectedId && !selected ? 0.72 : 1,
              }}
            >
              <title>{`${slice.name}: ${slice.percentage.toFixed(1)}%`}</title>
            </path>
          );
        })}

        {selectedSlice && (
          <g aria-hidden="true" pointerEvents="none">
            <circle
              cx={CHART_CENTER}
              cy={CHART_CENTER}
              r="43"
              fill="#020617"
              stroke={selectedSlice.color}
              strokeWidth="2"
              className="animate-[pulse_300ms_ease-out]"
            />
            <text
              x={CHART_CENTER}
              y={CHART_CENTER - 2}
              textAnchor="middle"
              className="fill-white font-semibold"
              fontSize="19"
            >
              {selectedSlice.percentage.toFixed(1)}%
            </text>
            <text
              x={CHART_CENTER}
              y={CHART_CENTER + 17}
              textAnchor="middle"
              className="fill-slate-300"
              fontSize="9"
            >
              Asistencia
            </text>
          </g>
        )}
      </svg>

      <div className="flex max-w-2xl flex-wrap justify-center gap-2">
        {slices.map((slice) => {
          const selected = selectedId === slice.id;

          return (
            <button
              key={slice.id}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleSlice(slice.id)}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-all duration-200 ${selected ? "scale-[1.03] border-white/30 bg-white/10 text-white shadow-sm" : "border-transparent text-gray-300 hover:border-slate-600 hover:bg-slate-800/70"}`}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: slice.color }}
              />
              <span>{slice.name}</span>
              <span className={selected ? "font-semibold text-white" : "text-gray-400"}>
                {slice.value} · {slice.percentage.toFixed(1)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}