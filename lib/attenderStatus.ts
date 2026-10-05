interface AttenderAttendanceStatus {
  checktime?: Date | string | null;
  paid?: boolean;
  rejected?: boolean;
  banned?: boolean;
}

export function countsAsAttendance(attender: AttenderAttendanceStatus): boolean {
  return Boolean(attender.checktime) &&
    (attender.paid === true ||
      (attender.rejected !== true && attender.banned !== true));
}
