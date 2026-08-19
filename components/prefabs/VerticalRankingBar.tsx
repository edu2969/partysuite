"use client";

import { RankingData } from "../events/types";

interface Props {
  totals: RankingData[];
}

export default function VerticalRankingBar({
  totals,
}: Props) {
  if (!totals?.length) {
    return (
      <span className="text-sm text-gray-500">
        No existen datos para mostrar
      </span>
    );
  }

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

  const max = Math.max(...totals.map((item) => item.total));

  return (
    <div className="w-full space-y-3">

      {totals.map((item, index) => {

        const percentage =
          max > 0
            ? (item.total / max) * 100
            : 0;

        return (
          <div
            key={`${item.name}-${index}`}
            className="w-full"
          >

            {/* Etiqueta + valor */}
            <div className="flex justify-between items-center mb-1">

              <span className="text-xs text-gray-300 truncate pr-3">
                {item.name}
              </span>

              <span className="text-xs text-gray-400 shrink-0">
                {item.total.toLocaleString("es-CL")}
              </span>

            </div>

            {/* Barra */}
            <div className="w-full h-7 rounded-sm overflow-hidden">

              <div
                className="h-full rounded-sm transition-all duration-500"
                style={{
                  width: `${percentage}%`,
                  backgroundColor:
                    colors[index % colors.length],
                }}
              />

            </div>

          </div>
        );
      })}

    </div>
  );
}