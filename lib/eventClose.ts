export const EVENT_TIME_ZONE = "America/Santiago";

export const EVENT_CLOSE_LIMIT_MESSAGE =
  "El cierre del evento no puede superar las 05:00 del día siguiente a la fecha del evento.";
export const LIST_CLOSE_ORDER_MESSAGE =
  "El cierre de lista debe ser posterior al inicio y no puede superar el cierre del evento.";

function getDateParts(date: Date, includeTime = false) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: EVENT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(includeTime && {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }),
  });

  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)])
  );
}

function getDateInEventTimeZone(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0
): Date {
  const wallTime = Date.UTC(year, month - 1, day, hour, minute);
  let timestamp = wallTime;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const zonedParts = getDateParts(new Date(timestamp), true);
    const representedWallTime = Date.UTC(
      zonedParts.year,
      zonedParts.month - 1,
      zonedParts.day,
      zonedParts.hour,
      zonedParts.minute,
      zonedParts.second
    );
    timestamp += wallTime - representedWallTime;
  }

  return new Date(timestamp);
}

function getCalendarDateParts(date: Date | string) {
  if (typeof date === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (match) {
      const [, yearText, monthText, dayText] = match;
      const year = Number(yearText);
      const month = Number(monthText);
      const day = Number(dayText);
      const parsed = new Date(Date.UTC(year, month - 1, day));

      if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() + 1 !== month ||
        parsed.getUTCDate() !== day
      ) {
        return null;
      }

      return { year, month, day };
    }
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return getDateParts(parsedDate);
}

export function getEventDateTime(
  businessDate: string,
  time: string,
  dayOffset = 0
): Date | null {
  const dateParts = getCalendarDateParts(businessDate);
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!dateParts || !timeMatch) return null;

  const calendarDate = new Date(
    Date.UTC(
      dateParts.year,
      dateParts.month - 1,
      dateParts.day + dayOffset
    )
  );
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const dateTime = getDateInEventTimeZone(
    calendarDate.getUTCFullYear(),
    calendarDate.getUTCMonth() + 1,
    calendarDate.getUTCDate(),
    hour,
    minute
  );
  const resolvedParts = getDateParts(dateTime, true);

  if (
    resolvedParts.year !== calendarDate.getUTCFullYear() ||
    resolvedParts.month !== calendarDate.getUTCMonth() + 1 ||
    resolvedParts.day !== calendarDate.getUTCDate() ||
    resolvedParts.hour !== hour ||
    resolvedParts.minute !== minute
  ) {
    return null;
  }

  return dateTime;
}

export function getEventSchedule(
  businessDate: string,
  startTime: string,
  listCloseTime: string,
  closeTime: string
):
  | {
      ok: true;
      businessDate: Date;
      startsAt: Date;
      listClosedAt: Date;
      closeAt: Date;
    }
  | {
      ok: false;
      field: "businessDate" | "startTime" | "listCloseTime" | "closeTime";
      message: string;
    } {
  const dateParts = getCalendarDateParts(businessDate);
  if (!dateParts) {
    return {
      ok: false,
      field: "businessDate",
      message: "La fecha o las horas ingresadas no son válidas para Chile.",
    };
  }

  const startAt = getEventDateTime(businessDate, startTime);
  if (!startAt) {
    return {
      ok: false,
      field: "startTime",
      message: "La hora de inicio no es válida para Chile.",
    };
  }

  const closeAt = getEventDateTime(businessDate, closeTime, 1);
  if (!closeAt) {
    return {
      ok: false,
      field: "closeTime",
      message: "La hora de cierre del evento no es válida para Chile.",
    };
  }

  const deadline = getEventCloseDeadline(businessDate);
  if (!deadline) {
    return {
      ok: false,
      field: "businessDate",
      message: "La fecha del evento no es válida.",
    };
  }

  if (closeAt.getTime() > deadline.getTime()) {
    return {
      ok: false,
      field: "closeTime",
      message: EVENT_CLOSE_LIMIT_MESSAGE,
    };
  }

  const startMinutes =
    Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3));
  const listCloseMinutes =
    Number(listCloseTime.slice(0, 2)) * 60 + Number(listCloseTime.slice(3));
  const listClosedAt = getEventDateTime(
    businessDate,
    listCloseTime,
    listCloseMinutes < startMinutes ? 1 : 0
  );

  if (
    !listClosedAt ||
    listClosedAt.getTime() <= startAt.getTime() ||
    listClosedAt.getTime() > closeAt.getTime()
  ) {
    return {
      ok: false,
      field: "listCloseTime",
      message: LIST_CLOSE_ORDER_MESSAGE,
    };
  }

  return {
    ok: true,
    businessDate: new Date(
      Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day)
    ),
    startsAt: startAt,
    listClosedAt,
    closeAt,
  };
}

export function getEventCalendarDayStart(eventDate: Date | string): Date | null {
  const parsedEventDate = new Date(eventDate);
  if (Number.isNaN(parsedEventDate.getTime())) return null;

  const eventDay = getDateParts(parsedEventDate);
  return getDateInEventTimeZone(
    eventDay.year,
    eventDay.month,
    eventDay.day,
    0
  );
}

export function getEventCountdownStart(eventDate: Date | string): Date | null {
  const eventDay = getCalendarDateParts(eventDate);
  if (!eventDay) return null;

  return getDateInEventTimeZone(
    eventDay.year,
    eventDay.month,
    eventDay.day,
    18,
    30
  );
}

export function getEventProCloseAt(eventDate: Date | string): Date | null {
  const eventDay = getCalendarDateParts(eventDate);
  if (!eventDay) return null;

  const followingDay = new Date(
    Date.UTC(eventDay.year, eventDay.month - 1, eventDay.day + 1)
  );

  return getDateInEventTimeZone(
    followingDay.getUTCFullYear(),
    followingDay.getUTCMonth() + 1,
    followingDay.getUTCDate(),
    0,
    30
  );
}

export function getEventImportDeadline(
  businessDate: Date | string,
  listClosedAt: Date | string,
  isPro: boolean,
  closeAt?: Date | string,
  maxImportTime?: string | null
): Date | null {
  const calendarDate = businessDate instanceof Date
    ? businessDate.toISOString().slice(0, 10)
    : businessDate;
  let listDeadline: Date;
  if (isPro && maxImportTime) {
    if (!isValidProImportTime(maxImportTime)) return null;

    const isFollowingDay = maxImportTime < "05:00";
    const deadline = getEventDateTime(
      calendarDate,
      maxImportTime,
      isFollowingDay ? 1 : 0
    );
    if (!deadline) return null;
    listDeadline = deadline;
  } else if (isPro) {
    const proDeadline = getEventProCloseAt(calendarDate);
    if (!proDeadline) return null;
    listDeadline = proDeadline;
  } else {
    listDeadline = new Date(listClosedAt);
  }

  if (!listDeadline || Number.isNaN(listDeadline.getTime())) return null;
  if (!isPro || !closeAt) return listDeadline;

  const eventDeadline = new Date(closeAt);
  if (Number.isNaN(eventDeadline.getTime())) return null;

  return new Date(Math.min(listDeadline.getTime(), eventDeadline.getTime()));
}

export function isValidProImportTime(value: unknown): value is string {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return false;
  }
  return value < "05:00" || value > "23:30";
}

export function getEventCloseDeadline(eventDate: Date | string): Date | null {
  const eventDay = getCalendarDateParts(eventDate);
  if (!eventDay) return null;
  const nextDay = new Date(
    Date.UTC(eventDay.year, eventDay.month - 1, eventDay.day + 1)
  );
  return getDateInEventTimeZone(
    nextDay.getUTCFullYear(),
    nextDay.getUTCMonth() + 1,
    nextDay.getUTCDate(),
    5
  );
}

export function isEventCloseWithinDeadline(
  eventDate: Date | string,
  closedAt: Date | string
): boolean {
  const deadline = getEventCloseDeadline(eventDate);
  const parsedClosedAt = new Date(closedAt);

  return Boolean(
    deadline &&
      !Number.isNaN(parsedClosedAt.getTime()) &&
      parsedClosedAt.getTime() <= deadline.getTime()
  );
}