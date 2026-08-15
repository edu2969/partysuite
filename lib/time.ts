// Reemplaza moment().format('HH:mm:ss'). Si prefieres seguir usando moment o
// dayjs, instálalo y sustituye estas dos funciones.

export function formatClock(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

// Equivalente al helper de Blaze `formatoHoraNocturno` usado en el template
// original (no estaba en el JS que compartiste, así que se reimplementa
// asumiendo formato 24h HH:mm). Ajusta si tu helper original hacía algo distinto.
export function formatHoraNocturna(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
