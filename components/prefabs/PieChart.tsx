import { ListeroData } from "../events/types";

export default function PieChart({
  listeros,
}: {
  listeros: ListeroData[];
}) {
  const total = listeros.reduce(
    (sum, listero) => sum + (listero.asisten || 0),
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

  const gradient = listeros
    .filter((listero) => listero.asisten > 0)
    .map((listero, index) => {
      const start = accumulated;
      const percentage = (listero.asisten / total) * 100;
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
        {listeros
          .filter((listero) => listero.asisten > 0)
          .map((listero, index) => (
            <div
              key={listero._id}
              className="flex items-center gap-2 text-xs text-gray-300"
            >
              <span
                className="h-3 w-3 rounded-sm"
                style={{
                  backgroundColor:
                    colors[index % colors.length],
                }}
              />

              {listero.userId.name} ({listero.asisten})
            </div>
          ))}
      </div>

    </div>
  );
}