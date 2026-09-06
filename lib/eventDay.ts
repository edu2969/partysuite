import moment from 'moment'

// Antes de esta hora se considera que todavía es "el evento de ayer" (la
// fiesta que arrancó anoche y sigue funcionando pasada la medianoche).
// Vive en un solo lugar porque tanto GET /api/events/current (qué evento
// mostrar) como POST /api/events/check-in (a qué evento se le hace
// check-in) necesitan exactamente la misma regla — si un día cambia el
// corte de las 5am, solo hay que tocarlo acá.
export const HORA_CORTE_MADRUGADA = 5

interface EventoConHorario {
  date: Date
  closeTime: number
}

function diaDelEvento() {
  const ahora = moment()
  return ahora.hour() < HORA_CORTE_MADRUGADA
    ? ahora.clone().subtract(1, 'day')
    : ahora.clone()
}

// 00:00:00 del día que corresponde al evento actual (hoy o ayer, según la
// regla de la madrugada). Sirve para consultas $gte sin límite superior.
export function getEventDayStart(): Date {
  return diaDelEvento().startOf('day').toDate()
}

// Rango [00:00:00, 00:00:00 del día siguiente) del día que corresponde al
// evento actual. Sirve para acotar una búsqueda a un solo día concreto
// (por ejemplo, a qué evento le corresponde hacerle check-in a alguien).
export function getEventDayRange(): { desde: Date; hasta: Date } {
  const dia = diaDelEvento()
  const desde = dia.clone().startOf('day').toDate()
  const hasta = dia.clone().add(1, 'day').startOf('day').add(5, 'hour').toDate()
  return { desde, hasta }
}

// Fecha/hora exacta de cierre de un evento. `closeTime` son los ms que se
// suman a las 12:00 del `date` del evento — mismo cálculo que ya usaba
// processListImport/import route. Para eventos que cruzan la medianoche,
// closeTime va a ser mayor a 12h y el resultado cae correctamente al día
// siguiente (ej: closeTime = 14h → cierre a las 2am del día después de
// `date`).
export function getFechaCierre(evento: EventoConHorario) {
  const ms = evento.closeTime
  const horas = Math.floor(ms / 3600000)
  const minutos = Math.floor((ms - horas * 3600000) / 60000)
  return moment(evento.date).add(1, "day").startOf("day").add(horas, 'h').add(minutos, 'm')
}

export function listaCerrada(evento: EventoConHorario): boolean {
  return moment().isAfter(getFechaCierre(evento))
}
