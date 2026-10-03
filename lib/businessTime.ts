import { format, subDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export const DEFAULT_TIME_ZONE = "America/Santiago";

export const HORA_CORTE_MADRUGADA = 5;

export function getBusinessDateForDate(
  date: Date,
  timeZone = DEFAULT_TIME_ZONE
): string {
  const zonedDate = toZonedTime(date, timeZone);

  const businessDate =
    zonedDate.getHours() < HORA_CORTE_MADRUGADA
      ? subDays(zonedDate, 1)
      : zonedDate;

  return format(businessDate, "yyyy-MM-dd");
}

export function getCurrentBusinessDate(
  timeZone = DEFAULT_TIME_ZONE
): string {
  return getBusinessDateForDate(new Date(), timeZone);
}

export function isDateClosed(
  closedAt?: Date | string | null
): boolean {
  if (!closedAt) return false;

  return new Date() >= new Date(closedAt);
}