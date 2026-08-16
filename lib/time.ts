export const formatClock = (date = new Date()) =>
    new Intl.DateTimeFormat("es-CL", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(date);

export const formatHoraNocturna = (value: string | Date | number) => {
    if (typeof value === "number") {
        const hours = Math.floor(value / 3_600_000) % 24;
        const minutes = Math.floor((value % 3_600_000) / 60_000);

        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }

    return new Intl.DateTimeFormat("es-CL", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(typeof value === "string" ? new Date(value) : value);
};