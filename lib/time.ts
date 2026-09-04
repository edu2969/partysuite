export const formatClock = (date = new Date()) =>
    new Intl.DateTimeFormat("es-CL", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(date);

// Formatea un offset en milisegundos (ej: attender.checktime, que se
// guarda como `now.getTime() - inicioDelDia.getTime()`) como HH:mm.
// Distinto de formatHoraNocturna: esa recibe una fecha/hora real, esta
// recibe una DURACIÓN desde las 00:00 del día del evento.
export function horaNocturna(offsetMs: number): string {
  const totalMinutos = Math.floor(offsetMs / 60000)
  const horas = Math.floor(totalMinutos / 60) % 24
  const minutos = totalMinutos % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(horas)}:${pad(minutos)}`
}