import Attender from "@/models/attender";
import Guest from "@/models/guest";
import User from "@/models/user";
import Event from "@/models/event";
import { Types } from "mongoose";

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
  sortArrives?: SortDirection;
  sortInscriptions?: SortDirection;
  sortAttendance?: SortDirection;
}

export type SortDirection = "asc" | "desc";

export function parseAttenderSort(searchParams: URLSearchParams) {
  const parseDirection = (value: string | null): SortDirection | undefined =>
    value === "asc" || value === "desc" ? value : undefined;

  return {
    sortArrives: parseDirection(searchParams.get("sortArrives")),
    sortInscriptions: parseDirection(searchParams.get("sortInscriptions")),
    sortAttendance: parseDirection(searchParams.get("sortAttendance")),
  };
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
  sortArrives,
  sortInscriptions,
  sortAttendance,
}: QueryAttendersOptions) {
  const baseQuery: Record<string, unknown> = {};
  if (eventId) {
    baseQuery.eventId = Types.ObjectId.isValid(eventId)
      ? new Types.ObjectId(eventId)
      : null;
  }

  const trimmedQ = (q || "").trim();

  if (trimmedQ) {
    const regex = new RegExp(escapeRegex(trimmedQ), "i");

    const [guestMatches, userMatches] = await Promise.all([
      Guest.find({ names: regex }).select("_id").lean(),
      User.find({ name: regex }).select("_id").lean(),
    ]);

    baseQuery.$or = [
      { guestId: { $in: guestMatches.map((g) => g._id) } },
      { userId: { $in: userMatches.map((u) => u._id) } },
    ];
  }

  const sort: Record<string, 1 | -1> = {};
  if (sortArrives) sort.sortArrives = sortArrives === "asc" ? 1 : -1;
  if (sortInscriptions) sort.sortInscriptions = sortInscriptions === "asc" ? 1 : -1;
  if (sortAttendance) sort.sortAttendance = sortAttendance === "asc" ? 1 : -1;
  sort.createdAt = eventId ? 1 : -1;
  sort._id = 1;

  const [result] = await Attender.aggregate([
    { $match: baseQuery },
    {
      $lookup: {
        from: Guest.collection.name,
        localField: "guestId",
        foreignField: "_id",
        as: "guest",
      },
    },
    { $unwind: { path: "$guest", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        sortArrives: { $ifNull: ["$guest.arrives", 0] },
        sortInscriptions: { $ifNull: ["$guest.inscriptions", 0] },
        sortAttendance: {
          $cond: [
            { $gt: [{ $ifNull: ["$guest.inscriptions", 0] }, 0] },
            {
              $divide: [
                { $multiply: [{ $ifNull: ["$guest.arrives", 0] }, 100] },
                "$guest.inscriptions",
              ],
            },
            0,
          ],
        },
      },
    },
    { $sort: sort },
    {
      $facet: {
        items: [
          { $skip: (page - 1) * pageSize },
          { $limit: pageSize },
          {
            $lookup: {
              from: User.collection.name,
              localField: "userId",
              foreignField: "_id",
              as: "user",
            },
          },
          { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: Event.collection.name,
              localField: "eventId",
              foreignField: "_id",
              as: "event",
            },
          },
          { $unwind: { path: "$event", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 1,
              guestId: "$guest._id",
              names: { $ifNull: ["$guest.names", ""] },
              user: { $ifNull: ["$user.name", ""] },
              eventName: { $ifNull: ["$event.name", ""] },
              banned: { $ifNull: ["$guest.banned", false] },
              arrives: { $ifNull: ["$guest.arrives", 0] },
              inscriptions: { $ifNull: ["$guest.inscriptions", 0] },
              vip: { $ifNull: ["$guest.vip", false] },
              royalties: "$guest.royalties",
              checktime: 1,
            },
          },
        ],
        metadata: [{ $count: "totalItems" }],
      },
    },
  ]).allowDiskUse(true);

  const attenders = result?.items ?? [];
  const totalItems = result?.metadata?.[0]?.totalItems ?? 0;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const items = attenders.map((attender) => {
    return {
      _id: String(attender._id),
      guestId: String(attender.guestId || ""),
      names: attender.names || "",
      user: attender.user || "",
      eventName: attender.eventName || "",
      banned: Boolean(attender.banned),
      arrives: attender.arrives || 0,
      inscriptions: attender.inscriptions || 0,
      vip: Boolean(attender.vip),
      checktime: attender.checktime
        ? new Date(attender.checktime).toISOString()
        : undefined,
      royalties: attender.royalties,
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