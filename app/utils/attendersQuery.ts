import Attender from "@/models/attender";
import Guest from "@/models/guest";
import User from "@/models/user";

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parsePagination(searchParams: URLSearchParams) {
  const pageParam = parseInt(searchParams.get("page") || "1", 10);
  const page = Math.max(1, Number.isNaN(pageParam) ? 1 : pageParam);

  const pageSizeParam = parseInt(
    searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE),
    10
  );
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.isNaN(pageSizeParam) ? DEFAULT_PAGE_SIZE : pageSizeParam)
  );

  return { page, pageSize };
}

interface QueryAttendersOptions {
  eventId?: string; // si no viene, busca entre TODOS los eventos
  q?: string;
  page: number;
  pageSize: number;
}

// Usada tanto por /api/events/[eventId]/attenders como por /api/attenders
// (sin eventId) — así ambas rutas quedan garantizadas con la misma lógica
// de búsqueda/paginación, en vez de mantener dos copias que se puedan
// desincronizar.
export async function queryAttenders({
  eventId,
  q,
  page,
  pageSize,
}: QueryAttendersOptions) {
  const baseQuery: Record<string, unknown> = {};
  if (eventId) baseQuery.eventId = eventId;

  const trimmedQ = (q || "").trim();

  if (trimmedQ) {
    const regex = new RegExp(escapeRegex(trimmedQ), "i");

    const [guestMatches, rpMatches] = await Promise.all([
      Guest.find({ names: regex }).select("_id").lean(),
      User.find({ name: regex }).select("_id").lean(),
    ]);

    baseQuery.$or = [
      { guestId: { $in: guestMatches.map((g) => g._id) } },
      { rpId: { $in: rpMatches.map((u) => u._id) } },
    ];
  }

  // Con un evento fijo, orden cronológico de llegada tiene sentido. Sin
  // evento (listado global), lo más reciente primero es más útil.
  const sort: Record<string, 1 | -1> = eventId ? { fecha: 1 } : { fecha: -1 };

  const [attenders, totalItems] = await Promise.all([
    Attender.find(baseQuery)
      .populate("guestId", "names baneado royalties")
      .populate("rpId", "name")
      .populate("eventId", "name")
      .sort(sort)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Attender.countDocuments(baseQuery),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const items = attenders.map((attender) => {
    const guest = attender.guestId as {
      _id?: string;
      names?: string;
      baneado?: boolean;
      royalties?: string;
    } | null;
    const rp = attender.rpId as { _id?: string; name?: string } | null;
    const event = attender.eventId as { _id?: string; name?: string } | null;

    return {
      _id: String(attender._id),
      guestId: String(guest?._id || ""),
      names: guest?.names || "",
      rp: rp?.name || "",
      eventName: event?.name || "",
      baneado: Boolean(guest?.baneado),
      checktime: attender.checktime
        ? new Date(attender.checktime).toISOString()
        : undefined,
      royalties: guest?.royalties,
    };
  });

  return {
    items,
    page,
    pageSize,
    totalItems,
    totalPages,
    hasMore: page < totalPages,
  };
}