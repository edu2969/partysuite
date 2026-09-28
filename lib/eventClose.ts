const EVENT_TIME_ZONE = "America/Santiago";

export const EVENT_CLOSE_LIMIT_MESSAGE =
  "La fecha de cierre de lista no puede superar las 05:00 del día siguiente a la fecha del evento.";

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
  const parsedEventDate = new Date(eventDate);
  if (Number.isNaN(parsedEventDate.getTime())) return null;

  const eventDay = getDateParts(parsedEventDate);
  return getDateInEventTimeZone(
    eventDay.year,
    eventDay.month,
    eventDay.day,
    18,
    30
  );
}

export function getEventProCloseAt(eventDate: Date | string): Date | null {
  const parsedEventDate = new Date(eventDate);
  if (Number.isNaN(parsedEventDate.getTime())) return null;

  const eventDay = getDateParts(parsedEventDate);
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

export function getEventCloseDeadline(eventDate: Date | string): Date | null {
  const parsedEventDate = new Date(eventDate);
  if (Number.isNaN(parsedEventDate.getTime())) return null;

  const eventDay = getDateParts(parsedEventDate);
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